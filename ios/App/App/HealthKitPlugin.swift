import Foundation
import Capacitor
import HealthKit

/*
 Reads the four character-sheet fields Health already knows, so someone
 does not have to type in what their phone can tell us.

 Written here rather than pulled in as a package: this needs four values
 and nothing else, and a dependency for that would be more code to trust
 and keep current than the code it replaces.

 Read-only, deliberately. Nothing is written back to Health, so the
 authorisation request asks to share nothing and Info.plist carries only
 NSHealthShareUsageDescription. Writing nutrition data back is a
 reasonable thing to want later, but it is a separate decision and should
 come with its own prompt rather than riding along on this one.
 */
@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readProfile", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    private var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()
        if let t = HKObjectType.characteristicType(forIdentifier: .biologicalSex) { types.insert(t) }
        if let t = HKObjectType.characteristicType(forIdentifier: .dateOfBirth)   { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .height)              { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .bodyMass)            { types.insert(t) }
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
