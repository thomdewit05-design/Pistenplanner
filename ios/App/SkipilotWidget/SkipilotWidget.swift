import WidgetKit
import SwiftUI

// Widgets voor het beginscherm en het toegangsscherm:
// - Skigebied: weer, verse sneeuw en wind in het laatst geopende skigebied (het weer haalt de widget zelf op bij Open-Meteo)
// - Skidag: kilometers, hoogtemeters en afdalingen van je skidag (komt uit het skidagboek in de app)
// De app zet het skigebied en de skidag in de gedeelde App Group (WidgetPlugin.swift).

let appGroup = "group.nl.skipilot.app"
let navy = Color(red: 15/255, green: 27/255, blue: 42/255)
let navyTop = Color(red: 34/255, green: 57/255, blue: 90/255)
let gold = Color(red: 1, green: 196/255, blue: 0)

// ---------- gedeelde gegevens ----------
struct SharedArea: Codable {
    let id: String
    let name: String
    let lat: Double
    let lon: Double
    let hi: Double
    let lo: Double
    let open: String?
    let close: String?
    let lang: String?
}

struct SharedDay: Codable {
    let date: String   // jjjjmmdd
    let area: String
    let km: Double
    let hm: Double
    let runs: Int
    let lifts: Int
    let vmax: Double
    let lang: String?
}

enum Shared {
    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
    static func read<T: Decodable>(_ key: String) -> T? {
        guard let s = defaults?.string(forKey: key), let data = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
}

// teksten in de taal van de app (nl, en, de)
struct Tr {
    let lang: String
    init(_ lang: String?) {
        let l = lang ?? Locale.current.language.languageCode?.identifier ?? "nl"
        self.lang = ["nl", "en", "de"].contains(l) ? l : "en"
    }
    func t(_ nl: String, _ en: String, _ de: String) -> String { lang == "nl" ? nl : lang == "de" ? de : en }
    var locale: Locale { Locale(identifier: lang == "nl" ? "nl_NL" : lang == "de" ? "de_DE" : "en_GB") }
    func num(_ v: Double, digits: Int = 0) -> String {
        v.formatted(.number.precision(.fractionLength(digits)).locale(locale))
    }
    func weekday(_ ymd: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = locale
        guard let d = f.date(from: ymd) else { return "" }
        let o = DateFormatter(); o.locale = locale; o.dateFormat = "EEE"
        return o.string(from: d).replacingOccurrences(of: ".", with: "").capitalized
    }
}

// ---------- weer ----------
struct Weather: Codable {
    let topTemp: Double
    let valleyTemp: Double
    let code: Int
    let wind: Double
    let snowDepth: Double?   // cm
    let fresh24: Double      // cm in de laatste 24 uur
    let days: [Day]
    let fetched: Date

    struct Day: Codable {
        let date: String
        let code: Int
        let max: Double
        let min: Double
        let snow: Double
    }
}

private struct OMResponse: Decodable {
    struct Current: Decodable {
        let time: String
        let temperature_2m: Double
        let weather_code: Int
        let wind_speed_10m: Double
        let snow_depth: Double?
    }
    struct Hourly: Decodable {
        let time: [String]
        let snowfall: [Double?]
    }
    struct Daily: Decodable {
        let time: [String]
        let weather_code: [Int?]
        let temperature_2m_max: [Double?]
        let temperature_2m_min: [Double?]
        let snowfall_sum: [Double?]
    }
    let current: Current
    let hourly: Hourly
    let daily: Daily
}

enum WeatherService {
    static func fetch(_ a: SharedArea) async -> Weather? {
        var c = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        c.queryItems = [
            .init(name: "latitude", value: "\(a.lat),\(a.lat)"), .init(name: "longitude", value: "\(a.lon),\(a.lon)"),
            .init(name: "elevation", value: "\(Int(a.hi)),\(Int(a.lo))"), .init(name: "timezone", value: "auto"),
            .init(name: "forecast_days", value: "3"), .init(name: "past_days", value: "1"),
            .init(name: "current", value: "temperature_2m,weather_code,wind_speed_10m,snow_depth"),
            .init(name: "hourly", value: "snowfall"),
            .init(name: "daily", value: "weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum")
        ]
        guard let url = c.url, let result = try? await URLSession.shared.data(from: url) else { return cached(a) }
        let (data, res) = result
        guard (res as? HTTPURLResponse)?.statusCode == 200,
              let both = try? JSONDecoder().decode([OMResponse].self, from: data), both.count == 2 else { return cached(a) }
        let top = both[0], valley = both[1]
        // verse sneeuw: de laatste 24 uur tot nu
        let h = top.hourly
        var fresh = 0.0
        if let now = h.time.lastIndex(where: { $0 <= top.current.time }), now < h.snowfall.count {
            fresh = h.snowfall[max(0, now - 23)...now].reduce(0) { $0 + ($1 ?? 0) }
        }
        let d = top.daily
        let days = d.time.indices.dropFirst().map { i in   // dag 0 is gisteren
            Weather.Day(date: d.time[i], code: d.weather_code[i] ?? 0, max: d.temperature_2m_max[i] ?? 0,
                        min: d.temperature_2m_min[i] ?? 0, snow: d.snowfall_sum[i] ?? 0)
        }
        let w = Weather(topTemp: top.current.temperature_2m, valleyTemp: valley.current.temperature_2m,
                        code: top.current.weather_code, wind: top.current.wind_speed_10m,
                        snowDepth: top.current.snow_depth.map { $0 * 100 }, fresh24: fresh, days: Array(days), fetched: Date())
        if let enc = try? JSONEncoder().encode(w) { Shared.defaults?.set(enc, forKey: "wx:\(a.id)") }
        return w
    }

    // zonder bereik: het laatste weerbericht van dit gebied, als het niet ouder is dan 12 uur
    static func cached(_ a: SharedArea) -> Weather? {
        guard let data = Shared.defaults?.data(forKey: "wx:\(a.id)"),
              let w = try? JSONDecoder().decode(Weather.self, from: data),
              Date().timeIntervalSince(w.fetched) < 12 * 3600 else { return nil }
        return w
    }

    static func symbol(_ code: Int) -> String {
        switch code {
        case 0: return "sun.max.fill"
        case 1, 2: return "cloud.sun.fill"
        case 3: return "cloud.fill"
        case 45, 48: return "cloud.fog.fill"
        case 51...57: return "cloud.drizzle.fill"
        case 61...67, 80...82: return "cloud.rain.fill"
        case 71...77, 85, 86: return "cloud.snow.fill"
        case 95...99: return "cloud.bolt.fill"
        default: return "cloud.fill"
        }
    }
}

// ---------- widget: skigebied ----------
struct AreaEntry: TimelineEntry {
    let date: Date
    let area: SharedArea?
    let weather: Weather?
}

struct AreaProvider: TimelineProvider {
    static let sample = SharedArea(id: "x", name: "Zillertal Arena", lat: 47.2, lon: 12.0, hi: 2400, lo: 1200, open: "08:30", close: "16:30", lang: nil)
    static let sampleWx = Weather(topTemp: -4, valleyTemp: 2, code: 71, wind: 18, snowDepth: 85, fresh24: 12, days: [
        .init(date: "2026-01-12", code: 71, max: -2, min: -8, snow: 6), .init(date: "2026-01-13", code: 0, max: 1, min: -9, snow: 0),
        .init(date: "2026-01-14", code: 2, max: 2, min: -6, snow: 0)], fetched: Date())

    func placeholder(in context: Context) -> AreaEntry { AreaEntry(date: Date(), area: Self.sample, weather: Self.sampleWx) }

    func getSnapshot(in context: Context, completion: @escaping (AreaEntry) -> Void) {
        guard let a: SharedArea = Shared.read("area") else { return completion(placeholder(in: context)) }
        completion(AreaEntry(date: Date(), area: a, weather: WeatherService.cached(a)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AreaEntry>) -> Void) {
        let next = Date().addingTimeInterval(30 * 60)
        guard let a: SharedArea = Shared.read("area") else {
            return completion(Timeline(entries: [AreaEntry(date: Date(), area: nil, weather: nil)], policy: .never))
        }
        Task {
            let w = await WeatherService.fetch(a)
            completion(Timeline(entries: [AreaEntry(date: Date(), area: a, weather: w)], policy: .after(next)))
        }
    }
}

struct AreaView: View {
    @Environment(\.widgetFamily) var family
    let entry: AreaEntry

    var body: some View {
        let tr = Tr(entry.area?.lang)
        if let a = entry.area {
            switch family {
            case .accessoryInline: inline(a, tr)
            case .accessoryRectangular: rectangular(a, tr)
            case .systemMedium: medium(a, tr)
            default: small(a, tr)
            }
        } else {
            empty(tr)
        }
    }

    func temp(_ v: Double, _ tr: Tr) -> String { "\(tr.num(v))°" }

    @ViewBuilder func small(_ a: SharedArea, _ tr: Tr) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(a.name).font(.caption.weight(.bold)).lineLimit(1).foregroundStyle(.white.opacity(0.85))
            if let w = entry.weather {
                HStack(spacing: 6) {
                    Image(systemName: WeatherService.symbol(w.code)).symbolRenderingMode(.multicolor).font(.title2)
                    Text(temp(w.topTemp, tr)).font(.system(size: 34, weight: .bold, design: .rounded)).foregroundStyle(.white)
                }
                Spacer(minLength: 0)
                Label(tr.t("\(tr.num(w.fresh24)) cm vers", "\(tr.num(w.fresh24)) cm fresh", "\(tr.num(w.fresh24)) cm Neuschnee"), systemImage: "snowflake")
                    .font(.caption.weight(.semibold)).foregroundStyle(w.fresh24 >= 1 ? gold : .white.opacity(0.8))
                if let s = w.snowDepth {
                    Label(tr.t("\(tr.num(s)) cm sneeuw", "\(tr.num(s)) cm snow", "\(tr.num(s)) cm Schnee"), systemImage: "mountain.2.fill")
                        .font(.caption2).foregroundStyle(.white.opacity(0.8))
                }
                Label("\(tr.num(w.wind)) km/h", systemImage: "wind").font(.caption2).foregroundStyle(.white.opacity(0.8))
            } else {
                Spacer(minLength: 0)
                Text(tr.t("Weer laden…", "Loading weather…", "Wetter wird geladen…")).font(.caption).foregroundStyle(.white.opacity(0.8))
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .labelStyle(TightLabel())
    }

    @ViewBuilder func medium(_ a: SharedArea, _ tr: Tr) -> some View {
        HStack(spacing: 14) {
            small(a, tr)
            if let w = entry.weather {
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(w.days.prefix(3), id: \.date) { d in
                        HStack(spacing: 6) {
                            Text(tr.weekday(d.date)).font(.caption.weight(.semibold)).frame(width: 30, alignment: .leading)
                            Image(systemName: WeatherService.symbol(d.code)).symbolRenderingMode(.multicolor).frame(width: 22)
                            Text("\(temp(d.max, tr)) / \(temp(d.min, tr))").font(.caption.monospacedDigit())
                            Spacer(minLength: 0)
                            if d.snow >= 1 { Text("\(tr.num(d.snow)) cm").font(.caption2.weight(.semibold)).foregroundStyle(gold) }
                        }
                    }
                    Spacer(minLength: 0)
                    HStack(spacing: 10) {
                        Label(tr.t("Dal \(temp(w.valleyTemp, tr))", "Valley \(temp(w.valleyTemp, tr))", "Tal \(temp(w.valleyTemp, tr))"), systemImage: "house.fill")
                        if let o = a.open, let c = a.close { Label("\(o)–\(c)", systemImage: "clock") }
                    }
                    .font(.caption2).foregroundStyle(.white.opacity(0.8)).labelStyle(TightLabel())
                }
                .foregroundStyle(.white)
            }
        }
    }

    @ViewBuilder func rectangular(_ a: SharedArea, _ tr: Tr) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(a.name).font(.headline).lineLimit(1)
            if let w = entry.weather {
                Label(temp(w.topTemp, tr), systemImage: WeatherService.symbol(w.code))
                Label(tr.t("\(tr.num(w.fresh24)) cm vers", "\(tr.num(w.fresh24)) cm fresh", "\(tr.num(w.fresh24)) cm Neuschnee"), systemImage: "snowflake")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder func inline(_ a: SharedArea, _ tr: Tr) -> some View {
        if let w = entry.weather {
            Label("\(a.name) \(temp(w.topTemp, tr)) · \(tr.num(w.fresh24)) cm", systemImage: WeatherService.symbol(w.code))
        } else {
            Text(a.name)
        }
    }

    @ViewBuilder func empty(_ tr: Tr) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "mountain.2.fill").font(.title2).foregroundStyle(gold)
            Text(tr.t("Open een skigebied in Skipilot", "Open a ski area in Skipilot", "Öffne ein Skigebiet in Skipilot"))
                .font(.caption.weight(.semibold)).foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct TightLabel: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) { configuration.icon; configuration.title }
    }
}

struct AreaWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SkipilotArea", provider: AreaProvider()) { entry in
            AreaView(entry: entry).containerBackground(for: .widget) {
                LinearGradient(colors: [navyTop, navy], startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
        .configurationDisplayName("Skigebied")
        .description("Weer, verse sneeuw en wind in je skigebied.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

// ---------- widget: skidag ----------
struct DayEntry: TimelineEntry {
    let date: Date
    let day: SharedDay?
}

struct DayProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry {
        DayEntry(date: Date(), day: SharedDay(date: "", area: "Zillertal Arena", km: 42.5, hm: 6120, runs: 14, lifts: 15, vmax: 71, lang: nil))
    }
    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) {
        let d: SharedDay? = Shared.read("day")
        completion(d == nil ? placeholder(in: context) : DayEntry(date: Date(), day: d))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        // om middernacht opnieuw, dan wordt "vandaag" "laatste skidag"
        let midnight = Calendar.current.startOfDay(for: Date().addingTimeInterval(86400))
        completion(Timeline(entries: [DayEntry(date: Date(), day: Shared.read("day"))], policy: .after(midnight)))
    }
}

struct DayView: View {
    @Environment(\.widgetFamily) var family
    let entry: DayEntry

    var body: some View {
        let tr = Tr(entry.day?.lang)
        if let d = entry.day {
            let title = isToday(d.date) ? tr.t("Vandaag", "Today", "Heute") : label(d.date, tr)
            if family == .accessoryRectangular {
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(.headline)
                    Text("\(tr.num(d.km, digits: 1)) km · \(tr.num(d.hm)) \(tr.t("hm", "m vert", "Hm"))")
                    Text("\(d.runs) \(tr.t("afdalingen", "runs", "Abfahrten")) · \(tr.num(d.vmax)) km/h")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.caption.weight(.bold)).foregroundStyle(gold)
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(tr.num(d.km, digits: 1)).font(.system(size: 32, weight: .bold, design: .rounded))
                        Text("km").font(.caption.weight(.semibold))
                    }
                    .foregroundStyle(.white)
                    Spacer(minLength: 0)
                    Label("\(tr.num(d.hm)) \(tr.t("hm", "m vert", "Hm"))", systemImage: "arrow.down.right")
                    Label("\(d.runs) \(tr.t("afdalingen", "runs", "Abfahrten"))", systemImage: "figure.skiing.downhill")
                    Label("\(tr.num(d.vmax)) km/h max", systemImage: "speedometer")
                }
                .font(.caption2).foregroundStyle(.white.opacity(0.85)).labelStyle(TightLabel())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "figure.skiing.downhill").font(.title2).foregroundStyle(gold)
                Text(tr.t("Start het skidagboek in Skipilot", "Start the ski diary in Skipilot", "Starte das Skitagebuch in Skipilot"))
                    .font(.caption.weight(.semibold)).foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    func isToday(_ ymd: String) -> Bool {
        let f = DateFormatter(); f.dateFormat = "yyyyMMdd"
        return f.string(from: Date()) == ymd
    }
    func label(_ ymd: String, _ tr: Tr) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyyMMdd"
        guard let d = f.date(from: ymd) else { return tr.t("Laatste skidag", "Last ski day", "Letzter Skitag") }
        return d.formatted(.dateTime.day().month(.abbreviated).locale(tr.locale))
    }
}

struct DayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SkipilotDay", provider: DayProvider()) { entry in
            DayView(entry: entry).containerBackground(for: .widget) {
                LinearGradient(colors: [navyTop, navy], startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
        .configurationDisplayName("Skidag")
        .description("Kilometers, hoogtemeters en afdalingen van je skidag.")
        .supportedFamilies([.systemSmall, .accessoryRectangular])
    }
}

@main
struct SkipilotWidgets: WidgetBundle {
    var body: some Widget {
        AreaWidget()
        DayWidget()
    }
}
