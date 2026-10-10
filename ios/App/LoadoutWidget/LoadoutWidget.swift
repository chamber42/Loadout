import WidgetKit
import SwiftUI

/*
 Loadout on the home screen: what is left of today, at a glance.

 The app writes a small summary into the shared App Group every time Today
 is drawn (WidgetBridgePlugin), and this reads it. It never computes
 anything itself — the targets, the step bonus and what counts as eaten are
 the app's to decide, and a second implementation here would sooner or
 later disagree with the first.

 A summary from an earlier day means the app has not been opened today, so
 the day is shown as untouched: the whole goal left and nothing eaten. That
 is what is true until something is logged, and it avoids yesterday's
 numbers sitting on the home screen as if they were today's.
 */

struct Summary: Codable {
    var day: String
    var word: String
    var className: String
    var kcalLeft: Int
    var eaten: Int
    var goal: Int
    var protein: [Int]      // [left, target]
    var carbs: [Int]
    var fat: [Int]
    var water: String       // e.g. "48 of 64 fl oz"
    var accent: String
    var colors: [String]    // protein, carbs, fat

    static let placeholder = Summary(day: "", word: "KCAL", className: "Loadout", kcalLeft: 1706,
                                     eaten: 0, goal: 1706, protein: [171, 171], carbs: [127, 127],
                                     fat: [57, 57], water: "", accent: "#e05a5a",
                                     colors: ["#8fae76", "#9a6ca8", "#d19a3c"])

    static func todayKey(_ date: Date = Date()) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: date)
    }

    static func load(at date: Date = Date()) -> Summary? {
        guard let json = UserDefaults(suiteName: "group.com.chamber42.loadout")?.string(forKey: "today"),
              let data = json.data(using: .utf8),
              var s = try? JSONDecoder().decode(Summary.self, from: data) else { return nil }
        if s.day != todayKey(date) {
            s.kcalLeft = s.goal; s.eaten = 0
            s.protein = [s.protein.last ?? 0, s.protein.last ?? 0]
            s.carbs = [s.carbs.last ?? 0, s.carbs.last ?? 0]
            s.fat = [s.fat.last ?? 0, s.fat.last ?? 0]
            s.water = ""
        }
        return s
    }
}

struct Entry: TimelineEntry {
    let date: Date
    let summary: Summary?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), summary: .placeholder) }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), summary: Summary.load() ?? .placeholder))
    }

    /* One entry now and one at midnight, when the day turns over and the
       numbers reset; the app replaces both whenever it writes. */
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let now = Date()
        let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86400))
        let entries = [Entry(date: now, summary: Summary.load(at: now)),
                       Entry(date: midnight, summary: Summary.load(at: midnight))]
        completion(Timeline(entries: entries, policy: .after(midnight.addingTimeInterval(60))))
    }
}

extension Color {
    init(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespaces)
        if h.hasPrefix("#") { h.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: h).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
    static let wBg = Color(hex: "#171213")
    static let wText = Color(hex: "#ece2e2")
    static let wMuted = Color(hex: "#ab9c9e")
}

struct MacroLine: View {
    let name: String
    let left: Int
    let color: Color
    var body: some View {
        HStack(spacing: 4) {
            Text("\(left)g").font(.system(size: 14, weight: .heavy)).foregroundColor(color)
            Text(name).font(.system(size: 11, weight: .semibold)).foregroundColor(.wMuted)
        }
    }
}

struct LoadoutWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry

    var body: some View {
        let s = entry.summary
        Group {
            if let s = s {
                if family == .systemSmall { small(s) } else { medium(s) }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    Text("LOADOUT").font(.system(size: 11, weight: .bold)).kerning(1.5).foregroundColor(Color(hex: "#e05a5a"))
                    Text("Open Loadout to set up today").font(.system(size: 14, weight: .semibold)).foregroundColor(.wText)
                }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .widgetBackground(Color.wBg)
    }

    func head(_ s: Summary) -> some View {
        Text(s.word.uppercased()).font(.system(size: 11, weight: .bold)).kerning(1.5).foregroundColor(Color(hex: s.accent))
    }

    func left(_ s: Summary, size: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(abs(s.kcalLeft).formatted()).font(.system(size: size, weight: .heavy))
                .foregroundColor(s.kcalLeft < 0 ? Color(hex: "#e04a4a") : .wText)
                .minimumScaleFactor(0.6).lineLimit(1)
            Text(s.kcalLeft < 0 ? "kcal over" : "kcal left").font(.system(size: 12, weight: .medium)).foregroundColor(.wMuted)
        }
    }

    func small(_ s: Summary) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            head(s)
            left(s, size: 32)
            Spacer(minLength: 0)
            MacroLine(name: "protein", left: s.protein.first ?? 0, color: Color(hex: s.colors.first ?? "#8fae76"))
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    func medium(_ s: Summary) -> some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                head(s)
                left(s, size: 36)
                Spacer(minLength: 0)
                Text("\(s.eaten.formatted()) of \(s.goal.formatted()) eaten").font(.system(size: 11)).foregroundColor(.wMuted)
            }
            Spacer(minLength: 0)
            VStack(alignment: .leading, spacing: 7) {
                Text(s.className).font(.system(size: 12, weight: .bold)).foregroundColor(Color(hex: s.accent)).lineLimit(1)
                MacroLine(name: "protein", left: s.protein.first ?? 0, color: Color(hex: s.colors[0]))
                MacroLine(name: "carbs", left: s.carbs.first ?? 0, color: Color(hex: s.colors[1]))
                MacroLine(name: "fat", left: s.fat.first ?? 0, color: Color(hex: s.colors[2]))
                if !s.water.isEmpty {
                    Text(s.water).font(.system(size: 11, weight: .semibold)).foregroundColor(Color(hex: "#8cbcee")).lineLimit(1)
                }
            }
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

extension View {
    /* iOS 17 draws a widget's background itself and asks for it this way;
       earlier versions take an ordinary background. */
    @ViewBuilder func widgetBackground(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { color }
        } else {
            self.padding().background(color)
        }
    }
}

@main
struct LoadoutWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LoadoutToday", provider: Provider()) { entry in
            LoadoutWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("What is left of today's calories and macros.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
