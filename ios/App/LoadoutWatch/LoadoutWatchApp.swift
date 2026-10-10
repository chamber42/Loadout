import SwiftUI
import WatchConnectivity

/*
 Loadout on the wrist: what is left of today, and water logged with a tap.

 The phone does every calculation and sends the Watch the same summary the
 home-screen widget reads (WidgetBridgePlugin), through WatchConnectivity's
 application context — the latest copy always wins, and it arrives even if
 this app was not running when it was sent.

 Water goes the other way as queued user-info transfers: a glass logged here
 reaches the phone the next time it can, and the phone adds it to the day's
 log. The count shown here moves at once and is replaced by the phone's own
 figure when that comes back, so the two can never stay apart.
 */

/* What the phone offers to log from. Everything needed to log a pick is in
   the pick itself, so a list that changed on the phone in the meantime can
   never make a tap log the wrong thing. */
struct Entry: Codable { var name: String?; var kcal: Double; var protein: Double; var carbs: Double; var fat: Double }
struct Meal: Codable, Hashable { var key: String; var name: String; var label: String; var kcal: Int; var items: Int; var dish: String }
struct Saved: Codable, Hashable { var id: String; var label: String; var kcal: Int }
struct Recent: Codable, Hashable {
    var kind: String; var label: String; var kcal: Int
    var foodKey: String?; var grams: Double?; var entry: Entry?
    static func == (a: Recent, b: Recent) -> Bool { a.label == b.label && a.kcal == b.kcal && a.foodKey == b.foodKey }
    func hash(into h: inout Hasher) { h.combine(label); h.combine(kcal); h.combine(foodKey) }
}
struct Options: Codable { var meals: [Meal]; var saved: [Saved]; var recents: [Recent] }

struct Summary: Codable {
    var day: String
    var word: String
    var className: String
    var kcalLeft: Int
    var eaten: Int
    var goal: Int
    var protein: [Int]
    var carbs: [Int]
    var fat: [Int]
    var water: String
    var waterMl: Int?
    var waterGoalMl: Int?
    var waterGlassMl: Int?
    var waterUnit: String?
    var accent: String
    var colors: [String]
    var watch: Options?

    static func todayKey() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: Date())
    }

    /* Yesterday's summary describes yesterday. Until the phone sends today's,
       today is shown as untouched — the whole goal left and nothing eaten. */
    func forToday() -> Summary {
        guard day != Summary.todayKey() else { return self }
        var s = self
        s.kcalLeft = goal; s.eaten = 0
        s.protein = [protein.last ?? 0, protein.last ?? 0]
        s.carbs = [carbs.last ?? 0, carbs.last ?? 0]
        s.fat = [fat.last ?? 0, fat.last ?? 0]
        s.waterMl = 0; s.water = ""
        if var w = s.watch { w.meals = w.meals.map { var m = $0; m.kcal = 0; m.items = 0; return m }; s.watch = w }
        return s
    }
}

final class Link: NSObject, ObservableObject, WCSessionDelegate {
    @Published var summary: Summary?

    override init() {
        super.init()
        if let saved = UserDefaults.standard.string(forKey: "today") { decode(saved) }
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    private func decode(_ json: String) {
        guard let data = json.data(using: .utf8),
              let s = try? JSONDecoder().decode(Summary.self, from: data) else { return }
        DispatchQueue.main.async { self.summary = s }
    }

    private func take(_ context: [String: Any]) {
        guard let json = context["today"] as? String else { return }
        UserDefaults.standard.set(json, forKey: "today")
        decode(json)
    }

    /* One glass either way. Shown at once, sent to the phone in the queue. */
    func water(_ glasses: Int) {
        guard var s = summary?.forToday() else { return }
        let glass = s.waterGlassMl ?? 250
        s.waterMl = max(0, (s.waterMl ?? 0) + glasses * glass)
        s.day = Summary.todayKey()
        summary = s
        if WCSession.default.activationState == .activated {
            WCSession.default.transferUserInfo(["water": glasses, "day": Summary.todayKey()])
        }
    }

    /* One pick, sent to the phone in the queue. The numbers here move at
       once by what the pick says it is worth, and the phone's own figures
       replace them when the next summary arrives. */
    func log(meal: Meal, kind: String, label: String, kcal: Int, extra: [String: Any]) {
        var pick: [String: Any] = ["day": Summary.todayKey(), "meal": meal.name, "mealKey": meal.key, "kind": kind]
        extra.forEach { pick[$0.key] = $0.value }
        guard let data = try? JSONSerialization.data(withJSONObject: pick),
              let json = String(data: data, encoding: .utf8) else { return }
        if var s = summary?.forToday() {
            s.eaten += kcal; s.kcalLeft -= kcal; s.day = Summary.todayKey()
            if var w = s.watch, let i = w.meals.firstIndex(of: meal) { w.meals[i].kcal += kcal; w.meals[i].items += 1; s.watch = w }
            summary = s
        }
        lastLogged = label
        if WCSession.default.activationState == .activated {
            WCSession.default.transferUserInfo(["log": json])
        }
    }
    @Published var lastLogged: String?

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        take(session.receivedApplicationContext)
    }
    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        take(context)
    }
}

extension Color {
    init(hex: String) {
        var h = hex; if h.hasPrefix("#") { h.removeFirst() }
        var v: UInt64 = 0; Scanner(string: h).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
}

struct TodayView: View {
    @EnvironmentObject var link: Link

    func waterText(_ s: Summary) -> String {
        let ml = Double(s.waterMl ?? 0), goal = Double(s.waterGoalMl ?? 0)
        if s.waterUnit == "L" {
            return String(format: "%g of %g L", (ml / 10).rounded() / 100, (goal / 10).rounded() / 100)
        }
        return "\(Int((ml / 29.5735).rounded())) of \(Int((goal / 29.5735).rounded())) fl oz"
    }

    var body: some View {
        if let raw = link.summary {
            let s = raw.forToday()
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    Text(s.className).font(.system(size: 14, weight: .bold)).foregroundColor(Color(hex: s.accent))
                    VStack(alignment: .leading, spacing: 0) {
                        Text(abs(s.kcalLeft).formatted()).font(.system(size: 40, weight: .heavy))
                            .foregroundColor(s.kcalLeft < 0 ? .red : .white).minimumScaleFactor(0.6).lineLimit(1)
                        Text(s.kcalLeft < 0 ? "kcal over" : "kcal left").font(.system(size: 13)).foregroundColor(.gray)
                    }
                    Text("\(s.eaten.formatted()) of \(s.goal.formatted()) eaten").font(.system(size: 12)).foregroundColor(.gray)
                    HStack(spacing: 10) {
                        macro(s.protein.first ?? 0, "protein", s.colors[0])
                        macro(s.carbs.first ?? 0, "carbs", s.colors[1])
                        macro(s.fat.first ?? 0, "fat", s.colors[2])
                    }
                    NavigationLink {
                        MealPicker()
                    } label: {
                        Label("Log food", systemImage: "fork.knife")
                    }.tint(Color(hex: s.accent))
                    if let last = link.lastLogged {
                        Text("Logged: \(last)").font(.system(size: 11)).foregroundColor(.gray).lineLimit(2)
                    }
                    Divider()
                    Text(waterText(s)).font(.system(size: 14, weight: .semibold)).foregroundColor(Color(hex: "#8cbcee"))
                    HStack {
                        Button("−") { link.water(-1) }.disabled((s.waterMl ?? 0) == 0)
                        Button("+ glass") { link.water(1) }.tint(Color(hex: "#6aa7e6"))
                    }
                }
            }
        } else {
            VStack(spacing: 6) {
                Text("LOADOUT").font(.system(size: 13, weight: .bold)).foregroundColor(Color(hex: "#e05a5a"))
                Text("Open Loadout on your iPhone to send today here.").font(.system(size: 14)).multilineTextAlignment(.center)
            }
        }
    }

    func macro(_ left: Int, _ name: String, _ hex: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("\(left)g").font(.system(size: 16, weight: .heavy)).foregroundColor(Color(hex: hex))
            Text(name).font(.system(size: 10)).foregroundColor(.gray)
        }
    }
}

@main
struct LoadoutWatchApp: App {
    @StateObject private var link = Link()
    var body: some Scene {
        WindowGroup { NavigationStack { TodayView() }.environmentObject(link) }
    }
}

/* ---- logging ------------------------------------------------------------ */

struct MealPicker: View {
    @EnvironmentObject var link: Link
    var body: some View {
        let meals = link.summary?.forToday().watch?.meals ?? []
        List(meals, id: \.self) { m in
            NavigationLink { FoodPicker(meal: m) } label: {
                HStack {
                    Text(m.label).font(.system(size: 16, weight: .semibold))
                    Spacer()
                    if m.items > 0 { Text("\(m.kcal)").font(.system(size: 13)).foregroundColor(.gray) }
                }
            }
        }
        .navigationTitle("Which meal?")
    }
}

struct FoodPicker: View {
    @EnvironmentObject var link: Link
    @Environment(\.dismiss) var dismiss
    let meal: Meal

    func done(_ kind: String, _ label: String, _ kcal: Int, _ extra: [String: Any] = [:]) {
        link.log(meal: meal, kind: kind, label: label, kcal: kcal, extra: extra)
        dismiss()
    }

    var body: some View {
        let o = link.summary?.watch
        List {
            if !meal.dish.isEmpty {
                Section("Your prep") {
                    Button { done("plan", meal.dish, 0) } label: { row(meal.dish, nil) }
                }
            }
            if let saved = o?.saved, !saved.isEmpty {
                Section("Saved meals") {
                    ForEach(saved, id: \.self) { m in
                        Button { done("saved", m.label, m.kcal, ["id": m.id]) } label: { row(m.label, m.kcal) }
                    }
                }
            }
            if let recents = o?.recents, !recents.isEmpty {
                Section("Recent") {
                    ForEach(recents, id: \.self) { r in
                        Button {
                            var extra: [String: Any] = [:]
                            if r.kind == "food" { extra["foodKey"] = r.foodKey ?? ""; extra["grams"] = r.grams ?? 100 }
                            else if let e = r.entry {
                                extra["entry"] = ["name": e.name ?? r.label, "kcal": e.kcal, "protein": e.protein, "carbs": e.carbs, "fat": e.fat]
                            }
                            done(r.kind, r.label, r.kcal, extra)
                        } label: { row(r.label, r.kcal) }
                    }
                }
            }
            Section {
                NavigationLink { QuickAdd(meal: meal) } label: { Label("Quick add calories", systemImage: "plus") }
            }
        }
        .navigationTitle(meal.label)
    }

    func row(_ label: String, _ kcal: Int?) -> some View {
        HStack {
            Text(label).font(.system(size: 15)).lineLimit(2)
            Spacer()
            if let k = kcal { Text("\(k)").font(.system(size: 13)).foregroundColor(.gray) }
        }
    }
}

/* A number and nothing else, turned with the crown. */
struct QuickAdd: View {
    @EnvironmentObject var link: Link
    @Environment(\.dismiss) var dismiss
    let meal: Meal
    @State private var kcal = 200.0

    var body: some View {
        VStack(spacing: 8) {
            Text("\(Int(kcal))").font(.system(size: 40, weight: .heavy))
                .focusable()
                .digitalCrownRotation($kcal, from: 0, through: 3000, by: 10, sensitivity: .medium)
            Text("kcal").font(.system(size: 13)).foregroundColor(.gray)
            Button("Log") {
                link.log(meal: meal, kind: "quick", label: "\(Int(kcal)) kcal", kcal: Int(kcal), extra: ["kcal": Int(kcal)])
                dismiss()
            }.disabled(kcal <= 0)
        }
        .navigationTitle("Quick add")
    }
}
