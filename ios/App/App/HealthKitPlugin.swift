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
        CAPPluginMethod(name: "readWorkouts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestWorkoutAuthorization", returnType: CAPPluginReturnPromise),
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

       Read as HealthKit's own merged total — see the note inside
       dailyTotals — so the figure matches what the Health app shows. */
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
            /* Each reading finishes on its own background queue, so every
               write into `out` is made on main, one at a time. */
            DispatchQueue.main.async {
                out["byDay"] = byDay
                if let today = today { out["today"] = today }
                if let average = average { out["average"] = average; out["days"] = days }
                group.leave()
            }
        }

        if let energy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
            group.enter()
            dailyTotals(of: energy, in: HKUnit.kilocalorie(), from: windowStart,
                        anchoredTo: startOfToday, calendar: calendar,
                        keyed: keyFormatter) { byDay, today, average, days in
                DispatchQueue.main.async {
                    out["energyByDay"] = byDay
                    if let today = today { out["energyToday"] = today }
                    if let average = average { out["energyAverage"] = average; out["energyDays"] = days }
                    group.leave()
                }
            }

            /* Which days an Apple Watch was being worn. A Watch measures
               active energy from heart rate all day, and an iPhone on its own
               estimates a small fraction of it from motion — so the same day
               reads several hundred kilocalories apart depending on what was
               worn. A "usual" averaged across both kinds is meaningless: every
               Watch day lands far above it. The caller compares a day only
               against days measured the same way. */
            group.enter()
            watchCoverage(of: energy, in: HKUnit.kilocalorie(), from: windowStart,
                          anchoredTo: startOfToday, keyed: keyFormatter) { byDay in
                DispatchQueue.main.async {
                    out["energyWatchByDay"] = byDay
                    group.leave()
                }
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

        /* One merged total per day, exactly as the Health app shows it.

           A statistics query does the merging itself: where an iPhone and an
           Apple Watch both recorded the same walk, HealthKit keeps one of the
           overlapping readings by the person's source priority instead of
           adding them, and still counts the parts of the day only one device
           saw. That is the figure Health reports, and it can only be had from
           a statistics query without .separateBySource.

           An earlier version asked for each source separately and kept the
           larger. That avoided the double count but lost everything the other
           device recorded on its own — a morning on the phone and an
           afternoon on the Watch came out as only the bigger half. */
        let query = HKStatisticsCollectionQuery(
            quantityType: type,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: windowStart, end: Date()),
            options: [.cumulativeSum],
            anchorDate: startOfToday,
            intervalComponents: oneDay)

        query.initialResultsHandler = { _, collection, _ in
            var byDay = JSObject()
            var today: Double?
            var completed: [(Date, Double)] = []

            collection?.enumerateStatistics(from: windowStart, to: Date()) { stat, _ in
                let total = stat.sumQuantity()?.doubleValue(for: unit) ?? 0
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

    /* For each day in the window, whether an Apple Watch contributed to it.

       Per-source sums say which sources recorded something on a day, but a
       source is an app, not a device, and its name is whatever the owner
       called their hardware. The device model is only on the samples, so
       each source is classified once by the newest sample it wrote — its
       productType reads "Watch7,1" on a Watch and "iPhone17,2" on a phone.

       A Watch counts as worn on a day when it recorded a real amount of
       active energy, not a trace: one left on its charger writes nothing,
       and one put on for an hour should not reclassify the day. 150 kcal
       sits between the two in real data — a Watch worn for a day reads 200
       to 900, one slipped on briefly reads 40 to 140. */
    private func watchCoverage(of type: HKQuantityType,
                               in unit: HKUnit,
                               from windowStart: Date,
                               anchoredTo startOfToday: Date,
                               keyed keyFormatter: DateFormatter,
                               done: @escaping (JSObject) -> Void) {
        var oneDay = DateComponents()
        oneDay.day = 1
        let query = HKStatisticsCollectionQuery(
            quantityType: type,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: windowStart, end: Date()),
            options: [.cumulativeSum, .separateBySource],
            anchorDate: startOfToday,
            intervalComponents: oneDay)

        query.initialResultsHandler = { [weak self] _, collection, _ in
            guard let self = self, let collection = collection else { done(JSObject()); return }
            var perDay: [(String, [(HKSource, Double)])] = []
            var sources = Set<HKSource>()
            collection.enumerateStatistics(from: windowStart, to: Date()) { stat, _ in
                var row: [(HKSource, Double)] = []
                for source in stat.sources ?? [] {
                    let v = stat.sumQuantity(for: source)?.doubleValue(for: unit) ?? 0
                    row.append((source, v))
                    sources.insert(source)
                }
                perDay.append((keyFormatter.string(from: stat.startDate), row))
            }
            self.watchSources(Array(sources), of: type) { watches in
                var out = JSObject()
                for (key, row) in perDay {
                    let fromWatch = row.filter { watches.contains($0.0) }.reduce(0.0) { $0 + $1.1 }
                    out[key] = fromWatch >= 150
                }
                done(out)
            }
        }
        store.execute(query)
    }

    private func watchSources(_ sources: [HKSource],
                              of type: HKQuantityType,
                              done: @escaping (Set<HKSource>) -> Void) {
        guard !sources.isEmpty else { done([]); return }
        let group = DispatchGroup()
        let lock = NSLock()
        var watches = Set<HKSource>()
        let newestFirst = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        for source in sources {
            group.enter()
            let q = HKSampleQuery(sampleType: type,
                                  predicate: HKQuery.predicateForObjects(from: source),
                                  limit: 1,
                                  sortDescriptors: [newestFirst]) { _, samples, _ in
                if let model = samples?.first?.sourceRevision.productType, model.hasPrefix("Watch") {
                    lock.lock(); watches.insert(source); lock.unlock()
                }
                group.leave()
            }
            store.execute(q)
        }
        group.notify(queue: .global()) { done(watches) }
    }

    /* ---- workouts --------------------------------------------------------

       Sessions Health holds for the last ninety days — a Watch records a
       strength session as readily as a run — as plain facts: when, what,
       how long and the energy it measured. Read, never written.

       Asked for separately rather than added to the main read request:
       someone who connected steps long ago was never asked about workouts,
       and a request that quietly widened would ask them at a moment they
       did not choose. This is asked when they tap to bring workouts in. */
    @objc func requestWorkoutAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false]); return
        }
        store.requestAuthorization(toShare: [], read: [HKObjectType.workoutType()]) { completed, error in
            if let error = error { call.reject(error.localizedDescription); return }
            call.resolve(["granted": completed])
        }
    }

    @objc func readWorkouts(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { call.resolve(["workouts": []]); return }
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: Date())
        guard let windowStart = calendar.date(byAdding: .day, value: -90, to: startOfToday) else {
            call.resolve(["workouts": []]); return
        }
        let keyFormatter = DateFormatter()
        keyFormatter.dateFormat = "yyyy-MM-dd"
        keyFormatter.locale = Locale(identifier: "en_US_POSIX")
        keyFormatter.timeZone = calendar.timeZone

        let newestFirst = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let query = HKSampleQuery(sampleType: HKObjectType.workoutType(),
                                  predicate: HKQuery.predicateForSamples(withStart: windowStart, end: Date()),
                                  limit: 300,
                                  sortDescriptors: [newestFirst]) { [weak self] _, samples, _ in
            var list: [JSObject] = []
            for case let w as HKWorkout in samples ?? [] {
                var o = JSObject()
                o["id"] = w.uuid.uuidString
                o["day"] = keyFormatter.string(from: w.startDate)
                o["start"] = ISO8601DateFormatter().string(from: w.startDate)
                o["minutes"] = Int((w.duration / 60).rounded())
                o["kind"] = self?.workoutKind(w.workoutActivityType) ?? "other"
                o["name"] = self?.workoutName(w.workoutActivityType) ?? "Workout"
                /* iOS 16 keeps a workout's energy as a statistic; earlier
                   versions as totalEnergyBurned. */
                var kcal: Double?
                if #available(iOS 16.0, *) {
                    if let type = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
                        kcal = w.statistics(for: type)?.sumQuantity()?.doubleValue(for: .kilocalorie())
                    }
                } else {
                    kcal = w.totalEnergyBurned?.doubleValue(for: .kilocalorie())
                }
                if let kcal = kcal { o["kcal"] = Int(kcal.rounded()) }
                o["source"] = w.sourceRevision.source.name
                list.append(o)
            }
            DispatchQueue.main.async { call.resolve(["workouts": list]) }
        }
        store.execute(query)
    }

    private func workoutKind(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .traditionalStrengthTraining, .functionalStrengthTraining, .coreTraining: return "strength"
        case .running, .walking, .cycling, .swimming, .elliptical, .rowing, .stairClimbing,
             .highIntensityIntervalTraining, .mixedCardio, .hiking: return "cardio"
        default: return "other"
        }
    }

    private func workoutName(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .traditionalStrengthTraining: return "Strength training"
        case .functionalStrengthTraining:  return "Functional strength"
        case .coreTraining:                return "Core training"
        case .running:                     return "Run"
        case .walking:                     return "Walk"
        case .cycling:                     return "Ride"
        case .swimming:                    return "Swim"
        case .elliptical:                  return "Elliptical"
        case .rowing:                      return "Row"
        case .stairClimbing:               return "Stair climb"
        case .highIntensityIntervalTraining: return "HIIT"
        case .mixedCardio:                 return "Cardio"
        case .hiking:                      return "Hike"
        case .yoga:                        return "Yoga"
        case .flexibility:                 return "Stretching"
        default:                           return "Workout"
        }
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
