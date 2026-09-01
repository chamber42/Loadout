import Foundation
import Capacitor
import HealthKit

/*
 Reads the four character-sheet fields Health already knows, so someone
 does not have to type in what their phone can tell us.

 Written here rather than pulled in as a package: this needs four values
 and nothing else, and a dependency for that would be more code to trust
 and keep current than the code it replaces.

 Reading and writing are kept apart on purpose. requestAuthorization asks
 only to READ, exactly as it always did, so nobody who granted that is
 re-prompted or has their answer widened underneath them.
 requestWriteAuthorization is a second, separate request, made only when
 someone turns nutrition writing on. Info.plist carries a usage string for
 each.

 What is written is only ever what the person logged in the journal, and
 only into the six dietary types below. Loadout deletes and rewrites its
 OWN samples for a day when that day is re-saved — HealthKit scopes such a
 delete to samples this app wrote, so a day logged in another app is never
 touched.
 */
@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readProfile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readSteps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readWeights", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canWrite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestWriteAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeNutrition", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    private var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()
        if let t = HKObjectType.characteristicType(forIdentifier: .biologicalSex) { types.insert(t) }
        if let t = HKObjectType.characteristicType(forIdentifier: .dateOfBirth)   { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .height)              { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .bodyMass)            { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .stepCount)           { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)  { types.insert(t) }
        return types
    }

    /* False on iPad and in the simulator. The caller uses this to decide
       whether to offer the button at all, rather than showing a control
       that can only fail. */
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    /* The `granted` flag here means the user finished the permission sheet,
       NOT that they allowed anything. HealthKit will not tell an app which
       read permissions were denied — that is deliberate, since knowing an
       app was refused access to, say, pregnancy data is itself a
       disclosure. So this cannot be used to decide what to ask for next;
       only readProfile's actual results can. */
    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        store.requestAuthorization(toShare: [], read: readTypes) { completed, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            call.resolve(["granted": completed])
        }
    }

    /* Resolves with only the fields that came back. A denied read and a
       value that was never recorded are indistinguishable from here — both
       are simply absent — so the caller must treat every key as optional
       and leave the user to type in whatever is missing. */
    @objc func readProfile(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve([:])
            return
        }

        var out = JSObject()

        /* Characteristics are stored values rather than samples, so they
           read synchronously. `try?` covers both "not authorised" and
           "never set", which need the same handling anyway. */
        if let sex = try? store.biologicalSex().biologicalSex {
            switch sex {
            case .male:   out["sex"] = "male"
            case .female: out["sex"] = "female"
            default:      break   // notSet and other: leave it to the user
            }
        }

        if let components = try? store.dateOfBirthComponents(), let born = components.date {
            let years = Calendar.current.dateComponents([.year], from: born, to: Date()).year
            if let years = years, years > 0, years < 130 { out["age"] = years }
        }

        /* Both sample reads finish on background queues. Their completions
           are bounced to main before touching `out` so the two cannot race
           each other writing into the same dictionary. */
        let group = DispatchGroup()

        group.enter()
        latestQuantity(.height, in: .inch()) { value in
            if let value = value { out["heightIn"] = value }
            group.leave()
        }

        group.enter()
        latestQuantity(.bodyMass, in: .pound()) { value in
            if let value = value { out["bodyweight"] = value }
            group.leave()
        }

        group.notify(queue: .main) { call.resolve(out) }
    }

    /* Today's step count, plus the daily average over the last seven days so
       the sheet can say whether today is a normal day or not.

       Resolves with nothing at all when steps are unreadable, for the same
       reason readProfile does: a refused permission and a phone that
       recorded no steps are indistinguishable, so the caller has to treat
       an absent figure as "unknown" rather than as zero. Reporting zero
       steps to someone who walked all day would be worse than saying
       nothing.

       Counted per source and then taken as the largest, not the sum — see
       the note inside dailyTotals. Summing double-counted any day where a
       phone and a Watch both recorded the same walk. */
    @objc func readSteps(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              let type = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            call.resolve([:])
            return
        }

        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: Date())
        /* A month back, so the journal can show the step count for whichever
           past day is being looked at, not only for today. */
        guard let windowStart = calendar.date(byAdding: .day, value: -30, to: startOfToday) else {
            call.resolve([:])
            return
        }

        /* Keys must match the journal's own day keys exactly. POSIX locale so
           a non-Gregorian or non-Latin-digit device still produces 2026-08-20
           rather than something the JS side cannot look up. */
        let keyFormatter = DateFormatter()
        keyFormatter.dateFormat = "yyyy-MM-dd"
        keyFormatter.locale = Locale(identifier: "en_US_POSIX")
        keyFormatter.timeZone = calendar.timeZone

        var out = JSObject()
        let group = DispatchGroup()

        /* Steps, and active energy, gathered the same way. Active energy is
           the better signal where it exists — Apple derives it from heart
           rate and motion, so it knows the difference between a flat stroll
           and a hill, which a step count never can. It is not always there,
           though: a phone left on a desk records neither, and a phone
           without a Watch records far less of it. So both are fetched and
           the caller decides which it can trust. */
        group.enter()
        dailyTotals(of: type, in: HKUnit.count(), from: windowStart,
                    anchoredTo: startOfToday, calendar: calendar,
                    keyed: keyFormatter) { byDay, today, average, days in
            out["byDay"] = byDay
            if let today = today { out["today"] = today }
            if let average = average { out["average"] = average; out["days"] = days }
            group.leave()
        }

        if let energy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
            group.enter()
            dailyTotals(of: energy, in: HKUnit.kilocalorie(), from: windowStart,
                        anchoredTo: startOfToday, calendar: calendar,
                        keyed: keyFormatter) { byDay, today, average, days in
                out["energyByDay"] = byDay
                if let today = today { out["energyToday"] = today }
                if let average = average { out["energyAverage"] = average; out["energyDays"] = days }
                group.leave()
            }
        }

        group.notify(queue: .main) { call.resolve(out) }
    }

    /* One day-by-day cumulative total, plus today's figure and the mean of
       the last seven COMPLETED days.

       Seven days even though a month is returned: the mean is meant to say
       "a usual day lately", and a month is long enough to average away a
       real change in how much someone is moving. Today is left out of it
       because it is still being lived, and a part-finished day would drag
       the figure down for no reason. */
    private func dailyTotals(of type: HKQuantityType,
                             in unit: HKUnit,
                             from windowStart: Date,
                             anchoredTo startOfToday: Date,
                             calendar: Calendar,
                             keyed keyFormatter: DateFormatter,
                             done: @escaping (JSObject, Int?, Int?, Int) -> Void) {
        var oneDay = DateComponents()
        oneDay.day = 1

        /* separateBySource, and then the LARGEST source rather than the sum
           of all of them.

           A plain cumulativeSum adds every matching sample, and an iPhone and
           an Apple Watch worn together both record steps for the same walk —
           so the total came out close to double what the Health app shows for
           the same day. Health does not sum; it applies its own source
           priority and reports one figure.

           Taking the maximum is the closest approximation available through
           this API, and it is right for the reason the double count happens:
           the two devices are recording the SAME walk, not two different
           ones, so the honest answer is the better-instrumented of the two
           readings rather than their sum. A Watch worn all day sees strictly
           more than a phone left on a desk, so the maximum picks it without
           anything here having to know what a Watch is — and it degrades to
           exactly the old behaviour when there is only one source.

           Deliberately not hardcoding a preference for Apple Watch by bundle
           identifier: it would need updating for every other device somebody
           might wear, and picking the largest reading gets there anyway. */
        let query = HKStatisticsCollectionQuery(
            quantityType: type,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: windowStart, end: Date()),
            options: [.cumulativeSum, .separateBySource],
            anchorDate: startOfToday,
            intervalComponents: oneDay)

        query.initialResultsHandler = { _, collection, _ in
            var byDay = JSObject()
            var today: Double?
            var completed: [(Date, Double)] = []

            collection?.enumerateStatistics(from: windowStart, to: Date()) { stat, _ in
                var total = 0.0
                if let sources = stat.sources, !sources.isEmpty {
                    for source in sources {
                        let v = stat.sumQuantity(for: source)?.doubleValue(for: unit) ?? 0
                        if v > total { total = v }
                    }
                } else {
                    /* No per-source breakdown available: fall back to the
                       combined figure, which is what it always was. */
                    total = stat.sumQuantity()?.doubleValue(for: unit) ?? 0
                }
                byDay[keyFormatter.string(from: stat.startDate)] = Int(total.rounded())
                if calendar.isDate(stat.startDate, inSameDayAs: startOfToday) {
                    today = total
                } else {
                    completed.append((stat.startDate, total))
                }
            }

            let recent = completed.sorted { $0.0 > $1.0 }.prefix(7).map { $0.1 }
            let mean = recent.isEmpty ? nil
                     : Int((recent.reduce(0, +) / Double(recent.count)).rounded())

            done(byDay, today.map { Int($0.rounded()) }, mean, recent.count)
        }

        store.execute(query)
    }

    /* Every weigh-in Health holds for the last year, one figure per day.

       This is what makes a connected scale useful: someone who steps on a
       Withings or a Renpho every morning has a year of readings sitting in
       Health, and until now Loadout asked them to type today's in by hand
       while ignoring all of it.

       Averaged within a day rather than taking the first or the last.
       Someone who weighs twice in a morning has two equally real readings,
       and the mean of them is a better estimate of that day than either
       alone; the app's own trend smoothing then does the rest.

       A year rather than a month, unlike the step window. Steps are read to
       describe today; weights are read to establish a trend, and a trend
       wants as much history as exists. It is one query either way.

       Resolves with nothing when weights are unreadable, for the same
       reason readProfile does: a refused permission and a phone that holds
       no weigh-ins are indistinguishable from here. */
    @objc func readWeights(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
            call.resolve([:])
            return
        }

        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: Date())
        guard let windowStart = calendar.date(byAdding: .day, value: -365, to: startOfToday) else {
            call.resolve([:])
            return
        }

        let keyFormatter = DateFormatter()
        keyFormatter.dateFormat = "yyyy-MM-dd"
        keyFormatter.locale = Locale(identifier: "en_US_POSIX")
        keyFormatter.timeZone = calendar.timeZone

        var oneDay = DateComponents()
        oneDay.day = 1

        let query = HKStatisticsCollectionQuery(
            quantityType: type,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: windowStart, end: Date()),
            options: .discreteAverage,
            anchorDate: startOfToday,
            intervalComponents: oneDay)

        query.initialResultsHandler = { _, collection, _ in
            var byDay = JSObject()
            collection?.enumerateStatistics(from: windowStart, to: Date()) { stat, _ in
                /* averageQuantity is nil on a day with no weigh-in, which is
                   most days for most people — skipped rather than written as
                   zero, which would read as a weightless morning. */
                guard let value = stat.averageQuantity()?.doubleValue(for: .pound()) else { return }
                byDay[keyFormatter.string(from: stat.startDate)] = round(value * 10) / 10
            }
            DispatchQueue.main.async { call.resolve(["byDay": byDay]) }
        }

        store.execute(query)
    }

    /* ---- writing -------------------------------------------------------

       The dietary types Loadout may write. In practice the journal stores
       only calories and the three macros against each entry, so those four
       are what actually get sent today; fibre and sodium are declared
       because the app models them elsewhere and an entry may carry them
       later, and each field is simply skipped when the caller omits it.

       Nothing derived is ever written. A per-day fibre figure could be
       reconstructed from the foods behind the entries, but it would be an
       estimate, and an estimate does not belong in a shared store that
       other apps will read as measurement. */
    private var shareTypes: Set<HKSampleType> {
        var types = Set<HKSampleType>()
        let ids: [HKQuantityTypeIdentifier] = [
            .dietaryEnergyConsumed, .dietaryProtein, .dietaryCarbohydrates,
            .dietaryFatTotal, .dietaryFiber, .dietarySodium
        ]
        for id in ids {
            if let t = HKObjectType.quantityType(forIdentifier: id) { types.insert(t) }
        }
        return types
    }

    private func unitFor(_ id: HKQuantityTypeIdentifier) -> HKUnit {
        switch id {
        case .dietaryEnergyConsumed: return .kilocalorie()
        case .dietarySodium:         return .gramUnit(with: .milli)
        default:                     return .gram()
        }
    }

    /* Whether writing is possible AND already permitted.

       Unlike reading, HealthKit does tell an app whether it may write —
       write permission is not itself a disclosure, since the app already
       knows what it is trying to save. So this can be trusted to decide
       whether to show a control, which the read side could never do. */
    @objc func canWrite(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false, "authorized": false])
            return
        }
        let authorized = shareTypes.allSatisfy {
            store.authorizationStatus(for: $0) == .sharingAuthorized
        }
        call.resolve(["available": true, "authorized": authorized])
    }

    /* A separate prompt from the read one, deliberately: someone who agreed
       to let Loadout read their weight has not agreed to let it write their
       meals, and rolling the two together would take that decision from
       them. */
    @objc func requestWriteAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        store.requestAuthorization(toShare: shareTypes, read: []) { [weak self] _, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            guard let self = self else { call.resolve(["granted": false]); return }
            let granted = self.shareTypes.allSatisfy {
                self.store.authorizationStatus(for: $0) == .sharingAuthorized
            }
            call.resolve(["granted": granted])
        }
    }

    /* One day's totals, replacing whatever Loadout wrote for that day before.

       Delete-then-write rather than append, because a journal gets edited:
       someone adds a forgotten lunch at nine in the evening and the day's
       energy must end up stated once, correctly, not twice. The delete
       predicate is scoped to this app's own samples — HKQuery's
       predicateForObjects(from:) with the default source — so a breakfast
       logged in somebody else's app on the same day survives untouched.

       Samples are stamped across the whole day rather than at the moment of
       saving, since that is what they describe. A day with nothing in it is
       a valid request: it deletes what was there and writes nothing, which
       is how clearing a day propagates. */
    @objc func writeNutrition(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["written": false]); return
        }
        guard let dayKey = call.getString("day") else {
            call.reject("writeNutrition needs a day"); return
        }

        let keyFormatter = DateFormatter()
        keyFormatter.dateFormat = "yyyy-MM-dd"
        keyFormatter.locale = Locale(identifier: "en_US_POSIX")
        keyFormatter.timeZone = Calendar.current.timeZone

        guard let start = keyFormatter.date(from: dayKey),
              let end = Calendar.current.date(byAdding: .day, value: 1, to: start) else {
            call.reject("writeNutrition could not read the day"); return
        }

        let totals = call.getObject("totals") ?? JSObject()
        let mapping: [(String, HKQuantityTypeIdentifier)] = [
            ("kcal",    .dietaryEnergyConsumed),
            ("protein", .dietaryProtein),
            ("carbs",   .dietaryCarbohydrates),
            ("fat",     .dietaryFatTotal),
            ("fibre",   .dietaryFiber),
            ("sodium",  .dietarySodium),
        ]

        var samples: [HKQuantitySample] = []
        for (field, id) in mapping {
            guard let type = HKQuantityType.quantityType(forIdentifier: id) else { continue }
            /* A missing figure and a zero are different: absent means the
               journal does not track it for this day, and inventing a zero
               would tell every other app the person ate no sodium. */
            guard let raw = totals[field] as? NSNumber else { continue }
            let value = raw.doubleValue
            if !value.isFinite || value <= 0 { continue }
            samples.append(HKQuantitySample(
                type: type,
                quantity: HKQuantity(unit: unitFor(id), doubleValue: value),
                start: start,
                end: end))
        }

        let scoped = HKQuery.predicateForObjects(from: HKSource.default())
        let onDay = HKQuery.predicateForSamples(withStart: start, end: end,
                                                options: [.strictStartDate])
        let mine = NSCompoundPredicate(andPredicateWithSubpredicates: [scoped, onDay])

        let group = DispatchGroup()
        var failure: String?

        for type in shareTypes {
            group.enter()
            store.deleteObjects(of: type, predicate: mine) { _, _, _ in
                /* A delete that finds nothing reports an error on some iOS
                   versions, and a first-ever save legitimately finds nothing.
                   Deletion problems are therefore not treated as fatal: the
                   write below is what the caller is actually asking for. */
                group.leave()
            }
        }

        group.notify(queue: .main) { [weak self] in
            guard let self = self else { call.resolve(["written": false]); return }
            guard !samples.isEmpty else {
                call.resolve(["written": true, "samples": 0]); return
            }
            self.store.save(samples) { ok, error in
                if let error = error { failure = error.localizedDescription }
                DispatchQueue.main.async {
                    if ok {
                        call.resolve(["written": true, "samples": samples.count])
                    } else {
                        call.reject(failure ?? "Health refused the write")
                    }
                }
            }
        }
    }

    /* Most recent sample only. Health may hold years of weigh-ins from
       several sources; the newest is the one that describes the person now. */
    private func latestQuantity(_ identifier: HKQuantityTypeIdentifier,
                                in unit: HKUnit,
                                done: @escaping (Double?) -> Void) {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else {
            DispatchQueue.main.async { done(nil) }
            return
        }
        let newestFirst = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: type,
                                  predicate: nil,
                                  limit: 1,
                                  sortDescriptors: [newestFirst]) { _, samples, _ in
            let value = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: unit)
            DispatchQueue.main.async { done(value) }
        }
        store.execute(query)
    }
}
