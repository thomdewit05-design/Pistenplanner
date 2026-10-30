import WidgetKit
import SwiftUI

// Widgets voor het beginscherm en het toegangsscherm:
// - Skigebied: weer, verse sneeuw, liftentijden en waarschuwingen in het laatst geopende skigebied
//   (het weer haalt de widget zelf op bij Open-Meteo)
// - Skidag: kilometers, hoogtemeters, afdalingen en tijd op de piste (komt uit het skidagboek in de app)
// De app zet het skigebied en de skidag in de gedeelde App Group (WidgetPlugin.swift).

let appGroup = "group.nl.skipilot.app"
let navy = Color(red: 15/255, green: 27/255, blue: 42/255)
let navyTop = Color(red: 34/255, green: 57/255, blue: 90/255)
let gold = Color(red: 1, green: 196/255, blue: 0)
let soft = Color.white.opacity(0.8)

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
    let secs: Int?     // tijd op de piste in seconden (oudere versies van de app sturen dit niet mee)
    let lang: String?
}

enum Shared {
    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
    static func read<T: Decodable>(_ key: String) -> T? {
        guard let s = defaults?.string(forKey: key), let data = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
}

// teksten in de taal van de app (nl, en, de; fr en it waar een vertaling is meegegeven, anders Engels)
struct Tr {
    let lang: String
    init(_ lang: String?) {
        let l = lang ?? Locale.current.language.languageCode?.identifier ?? "nl"
        self.lang = ["nl", "en", "de", "fr", "it"].contains(l) ? l : "en"
    }
    func t(_ nl: String, _ en: String, _ de: String, fr: String? = nil, it: String? = nil) -> String {
        switch lang { case "nl": return nl; case "de": return de; case "fr": return fr ?? en; case "it": return it ?? en; default: return en }
    }
    var locale: Locale { Locale(identifier: ["nl": "nl_NL", "de": "de_DE", "fr": "fr_FR", "it": "it_IT"][lang] ?? "en_GB") }
    func num(_ v: Double, digits: Int = 0) -> String {
        v.formatted(.number.precision(.fractionLength(digits)).locale(locale))
    }
    func weekday(_ ymd: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = locale
        guard let d = f.date(from: ymd) else { return "" }
        let o = DateFormatter(); o.locale = locale; o.dateFormat = "EEE"
        return o.string(from: d).replacingOccurrences(of: ".", with: "").capitalized
    }
    // 80 minuten -> "1 u 20 min"
    func duration(minutes m: Int) -> String {
        let h = m / 60, r = m % 60
        let hu = t("u", "h", "Std."), mu = t("min", "min", "Min.")
        if h == 0 { return "\(r) \(mu)" }
        return r == 0 ? "\(h) \(hu)" : "\(h) \(hu) \(r) \(mu)"
    }
    func height(_ m: Double) -> String { "\(num((m / 50).rounded() * 50)) m" }
    func distance(_ m: Double) -> String { m >= 1000 ? "\(num(m / 1000, digits: m < 10000 ? 1 : 0)) km" : "\(num((m / 10).rounded() * 10)) m" }
}

// ---------- weer ----------
struct Weather: Codable {
    let topTemp: Double
    let valleyTemp: Double
    let code: Int
    let wind: Double
    let gusts: Double?
    let visibility: Double?  // meter
    let freezing: Double?    // vriesgrens in meter
    let snowDepth: Double?   // cm
    let fresh24: Double      // cm in de laatste 24 uur
    let sunset: String?      // "16:45"
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

// alles optioneel: als Open-Meteo een veld weglaat of leeg laat, tonen we de rest gewoon
private struct OMResponse: Decodable {
    struct Current: Decodable {
        let time: String
        let temperature_2m: Double?
        let weather_code: Int?
        let wind_speed_10m: Double?
        let wind_gusts_10m: Double?
        let visibility: Double?
        let freezing_level_height: Double?
        let snow_depth: Double?
    }
    struct Hourly: Decodable {
        let time: [String]?
        let snowfall: [Double?]?
    }
    struct Daily: Decodable {
        let time: [String]?
        let weather_code: [Int?]?
        let temperature_2m_max: [Double?]?
        let temperature_2m_min: [Double?]?
        let snowfall_sum: [Double?]?
        let sunset: [String?]?
    }
    let current: Current
    let hourly: Hourly?
    let daily: Daily?
}

enum WeatherService {
    static func fetch(_ a: SharedArea) async -> Weather? {
        var c = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        c.queryItems = [
            .init(name: "latitude", value: "\(a.lat),\(a.lat)"), .init(name: "longitude", value: "\(a.lon),\(a.lon)"),
            .init(name: "elevation", value: "\(Int(a.hi)),\(Int(a.lo))"), .init(name: "timezone", value: "auto"),
            .init(name: "forecast_days", value: "4"), .init(name: "past_days", value: "1"),
            .init(name: "current", value: "temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,visibility,freezing_level_height,snow_depth"),
            .init(name: "hourly", value: "snowfall"),
            .init(name: "daily", value: "weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,sunset")
        ]
        // korte time-out: een widget krijgt maar even de tijd; lukt het niet, dan het laatste bericht
        var req = URLRequest(url: c.url!); req.timeoutInterval = 12
        guard let result = try? await URLSession.shared.data(for: req) else { return cached(a) }
        let (data, res) = result
        guard (res as? HTTPURLResponse)?.statusCode == 200,
              let both = try? JSONDecoder().decode([OMResponse].self, from: data), both.count == 2,
              let topTemp = both[0].current.temperature_2m else { return cached(a) }
        let top = both[0], valley = both[1]
        // verse sneeuw: de laatste 24 uur tot nu
        var fresh = 0.0
        if let ht = top.hourly?.time, let sf = top.hourly?.snowfall, let now = ht.lastIndex(where: { $0 <= top.current.time }), now < sf.count {
            fresh = sf[max(0, now - 23)...now].reduce(0) { $0 + ($1 ?? 0) }
        }
        let d = top.daily
        let dt = d?.time ?? []
        func at<T>(_ arr: [T?]?, _ i: Int) -> T? { guard let arr = arr, i < arr.count else { return nil }; return arr[i] }
        let days = dt.indices.dropFirst().map { i in   // dag 0 is gisteren
            Weather.Day(date: dt[i], code: at(d?.weather_code, i) ?? 0, max: at(d?.temperature_2m_max, i) ?? 0,
                        min: at(d?.temperature_2m_min, i) ?? 0, snow: at(d?.snowfall_sum, i) ?? 0)
        }
        var sunset: String? = nil
        if let today: String = at(d?.sunset, 1) { sunset = String(today.suffix(5)) }
        let cur = top.current
        let w = Weather(topTemp: topTemp, valleyTemp: valley.current.temperature_2m ?? topTemp, code: cur.weather_code ?? 3,
                        wind: cur.wind_speed_10m ?? 0, gusts: cur.wind_gusts_10m, visibility: cur.visibility,
                        freezing: cur.freezing_level_height, snowDepth: cur.snow_depth.map { $0 * 100 },
                        fresh24: fresh, sunset: sunset, days: Array(days), fetched: Date())
        if let enc = try? JSONEncoder().encode(w) { Shared.defaults?.set(enc, forKey: "wx2:\(a.id)") }
        return w
    }

    // zonder bereik: het laatste weerbericht van dit gebied, als het niet ouder is dan 12 uur
    static func cached(_ a: SharedArea) -> Weather? {
        guard let data = Shared.defaults?.data(forKey: "wx2:\(a.id)"),
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

    static func describe(_ code: Int, _ tr: Tr) -> String {
        switch code {
        case 0: return tr.t("Zonnig", "Sunny", "Sonnig")
        case 1, 2: return tr.t("Half bewolkt", "Partly cloudy", "Teils bewölkt")
        case 3: return tr.t("Bewolkt", "Cloudy", "Bewölkt")
        case 45, 48: return tr.t("Mist", "Fog", "Nebel")
        case 51...57: return tr.t("Motregen", "Drizzle", "Nieselregen")
        case 61...67, 80...82: return tr.t("Regen", "Rain", "Regen")
        case 71...77, 85, 86: return tr.t("Sneeuw", "Snow", "Schnee")
        case 95...99: return tr.t("Onweer", "Thunderstorm", "Gewitter")
        default: return tr.t("Bewolkt", "Cloudy", "Bewölkt")
        }
    }
}

// ---------- handige regels: liften en waarschuwingen ----------
struct Line {
    let icon: String
    let text: String
    let warn: Bool
}

enum Info {
    private static func minutes(_ hhmm: String) -> Int? {
        let p = hhmm.split(separator: ":").compactMap { Int($0) }
        return p.count == 2 ? p[0] * 60 + p[1] : nil
    }

    // "Open tot 16:30 · nog 1 u 20 min", of wanneer ze weer opengaan
    static func lifts(_ a: SharedArea, at date: Date, _ tr: Tr) -> Line? {
        guard let o = a.open, let c = a.close, let om = minutes(o), let cm = minutes(c) else { return nil }
        let hm = Calendar.current.dateComponents([.hour, .minute], from: date)
        let now = (hm.hour ?? 0) * 60 + (hm.minute ?? 0)
        if now < om { return Line(icon: "cablecar", text: tr.t("Liften open om \(o)", "Lifts open at \(o)", "Lifte öffnen um \(o)"), warn: false) }
        if now >= cm { return Line(icon: "cablecar", text: tr.t("Liften dicht · morgen \(o)", "Lifts closed · tomorrow \(o)", "Lifte zu · morgen \(o)"), warn: false) }
        let left = tr.duration(minutes: cm - now)
        return Line(icon: "cablecar", text: tr.t("Open tot \(c) · nog \(left)", "Open until \(c) · \(left) left", "Offen bis \(c) · noch \(left)"), warn: cm - now <= 30)
    }

    // het belangrijkste dat je moet weten voor je de berg op gaat
    static func alert(_ w: Weather, _ tr: Tr) -> Line? {
        if let g = w.gusts, g >= 60 {
            return Line(icon: "wind", text: tr.t("Storm (\(tr.num(g)) km/h): liften kunnen dicht", "Gales (\(tr.num(g)) km/h): lifts may close", "Sturm (\(tr.num(g)) km/h): Lifte evtl. zu"), warn: true)
        }
        if let v = w.visibility, v < 300 {
            return Line(icon: "cloud.fog.fill", text: tr.t("Slecht zicht (\(tr.distance(v)))", "Poor visibility (\(tr.distance(v)))", "Schlechte Sicht (\(tr.distance(v)))"), warn: true)
        }
        if w.fresh24 >= 15 {
            return Line(icon: "snowflake", text: tr.t("Poederdag: \(tr.num(w.fresh24)) cm vers", "Powder day: \(tr.num(w.fresh24)) cm fresh", "Powdertag: \(tr.num(w.fresh24)) cm Neuschnee"), warn: true)
        }
        if w.topTemp <= -15 {
            return Line(icon: "thermometer.snowflake", text: tr.t("Erg koud: \(tr.num(w.topTemp))° boven", "Very cold: \(tr.num(w.topTemp))° at the top", "Sehr kalt: \(tr.num(w.topTemp))° oben"), warn: true)
        }
        return nil
    }

    static func fresh(_ w: Weather, _ tr: Tr) -> Line {
        Line(icon: "snowflake", text: tr.t("\(tr.num(w.fresh24)) cm vers", "\(tr.num(w.fresh24)) cm fresh", "\(tr.num(w.fresh24)) cm Neuschnee"), warn: w.fresh24 >= 1)
    }
}

struct LineView: View {
    let line: Line
    var font: Font = .caption2
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: line.icon).frame(width: 14)
            Text(line.text).lineLimit(1).minimumScaleFactor(0.65)
        }
        .font(font.weight(line.warn ? .semibold : .regular))
        .foregroundStyle(line.warn ? gold : soft)
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
    static let sampleWx = Weather(topTemp: -4, valleyTemp: 2, code: 71, wind: 18, gusts: 35, visibility: 8000, freezing: 1400, snowDepth: 85,
                                  fresh24: 18, sunset: "16:52", days: [
        .init(date: "2026-01-12", code: 71, max: -2, min: -8, snow: 6), .init(date: "2026-01-13", code: 0, max: 1, min: -9, snow: 0),
        .init(date: "2026-01-14", code: 2, max: 2, min: -6, snow: 0)], fetched: Date())

    func placeholder(in context: Context) -> AreaEntry { AreaEntry(date: Date(), area: Self.sample, weather: Self.sampleWx) }

    func getSnapshot(in context: Context, completion: @escaping (AreaEntry) -> Void) {
        guard let a: SharedArea = Shared.read("area") else { return completion(placeholder(in: context)) }
        if let w = WeatherService.cached(a) { return completion(AreaEntry(date: Date(), area: a, weather: w)) }
        if context.isPreview { return completion(AreaEntry(date: Date(), area: a, weather: Self.sampleWx)) }
        Task { completion(AreaEntry(date: Date(), area: a, weather: await WeatherService.fetch(a))) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AreaEntry>) -> Void) {
        let now = Date()
        guard let a: SharedArea = Shared.read("area") else {
            return completion(Timeline(entries: [AreaEntry(date: now, area: nil, weather: nil)], policy: .never))
        }
        Task {
            let w = await WeatherService.fetch(a)
            // elke 5 minuten een stand, zodat de aftelling tot de laatste lift klopt; na een half uur nieuw weer
            let entries = (0..<6).map { AreaEntry(date: now.addingTimeInterval(Double($0) * 300), area: a, weather: w) }
            completion(Timeline(entries: w == nil ? [entries[0]] : entries, policy: .after(now.addingTimeInterval(w == nil ? 5 * 60 : 30 * 60))))
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
            case .systemLarge: large(a, tr)
            default: small(a, tr)
            }
        } else {
            empty(tr)
        }
    }

    func temp(_ v: Double, _ tr: Tr) -> String { "\(tr.num(v))°" }

    // "18 cm vers · 85 cm": verse sneeuw en sneeuwhoogte op één regel
    func snowLine(_ w: Weather, _ tr: Tr) -> Line {
        var t = tr.t("\(tr.num(w.fresh24)) cm vers", "\(tr.num(w.fresh24)) cm fresh", "\(tr.num(w.fresh24)) cm neu")
        if let s = w.snowDepth, s >= 1 { t += " · \(tr.num(s)) cm" }
        return Line(icon: "snowflake", text: t, warn: w.fresh24 >= 1)
    }

    @ViewBuilder func small(_ a: SharedArea, _ tr: Tr) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(a.name).font(.caption.weight(.bold)).lineLimit(1).minimumScaleFactor(0.8).foregroundStyle(.white.opacity(0.85))
            if let w = entry.weather {
                HStack(spacing: 5) {
                    Image(systemName: WeatherService.symbol(w.code)).symbolRenderingMode(.multicolor).font(.title3)
                    Text(temp(w.topTemp, tr)).font(.system(size: 30, weight: .bold, design: .rounded)).minimumScaleFactor(0.7).foregroundStyle(.white)
                }
                Spacer(minLength: 0)
                LineView(line: snowLine(w, tr))
                if let al = Info.alert(w, tr), w.fresh24 < 15 { LineView(line: al) }
                else if let l = Info.lifts(a, at: entry.date, tr) { LineView(line: l) }
            } else {
                Spacer(minLength: 0)
                Text(tr.t("Weer laden…", "Loading weather…", "Wetter wird geladen…")).font(.caption).foregroundStyle(soft)
                if let l = Info.lifts(a, at: entry.date, tr) { LineView(line: l) }
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder func forecast(_ w: Weather, _ tr: Tr, count: Int) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            ForEach(w.days.prefix(count), id: \.date) { d in
                HStack(spacing: 6) {
                    Text(tr.weekday(d.date)).font(.caption.weight(.semibold)).frame(width: 30, alignment: .leading)
                    Image(systemName: WeatherService.symbol(d.code)).symbolRenderingMode(.multicolor).frame(width: 22)
                    Text("\(temp(d.max, tr)) / \(temp(d.min, tr))").font(.caption.monospacedDigit())
                    Spacer(minLength: 0)
                    if d.snow >= 1 { Text("\(tr.num(d.snow)) cm").font(.caption2.weight(.semibold)).foregroundStyle(gold) }
                }
            }
        }
        .foregroundStyle(.white)
    }

    @ViewBuilder func medium(_ a: SharedArea, _ tr: Tr) -> some View {
        HStack(spacing: 14) {
            small(a, tr)
            if let w = entry.weather {
                VStack(alignment: .leading, spacing: 5) {
                    forecast(w, tr, count: 3)
                    Spacer(minLength: 0)
                    LineView(line: Line(icon: "house.fill", text: tr.t("Dal \(temp(w.valleyTemp, tr))", "Valley \(temp(w.valleyTemp, tr))", "Tal \(temp(w.valleyTemp, tr))"), warn: false))
                    if let s = w.sunset { LineView(line: Line(icon: "sunset.fill", text: tr.t("Zon onder \(s)", "Sunset \(s)", "Sonnenuntergang \(s)"), warn: false)) }
                }
            }
        }
    }

    @ViewBuilder func large(_ a: SharedArea, _ tr: Tr) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.name).font(.headline).lineLimit(1).foregroundStyle(.white)
                    if let w = entry.weather {
                        Text("\(WeatherService.describe(w.code, tr)) · \(tr.t("boven", "top", "oben")) \(tr.height(a.hi))").font(.caption).foregroundStyle(soft)
                    }
                }
                Spacer(minLength: 0)
                if let w = entry.weather {
                    HStack(spacing: 6) {
                        Image(systemName: WeatherService.symbol(w.code)).symbolRenderingMode(.multicolor).font(.title)
                        Text(temp(w.topTemp, tr)).font(.system(size: 36, weight: .bold, design: .rounded)).foregroundStyle(.white)
                    }
                }
            }
            if let w = entry.weather {
                if let al = Info.alert(w, tr) {
                    LineView(line: al, font: .footnote)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(gold.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
                }
                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 5) {
                    GridRow {
                        LineView(line: Info.fresh(w, tr), font: .footnote)
                        if let s = w.snowDepth { LineView(line: Line(icon: "mountain.2.fill", text: tr.t("\(tr.num(s)) cm sneeuw", "\(tr.num(s)) cm snow", "\(tr.num(s)) cm Schnee"), warn: false), font: .footnote) }
                    }
                    GridRow {
                        LineView(line: Line(icon: "wind", text: w.gusts.map { "\(tr.num(w.wind)) km/h · \(tr.t("stoten", "gusts", "Böen")) \(tr.num($0))" } ?? "\(tr.num(w.wind)) km/h", warn: (w.gusts ?? 0) >= 60), font: .footnote)
                        if let v = w.visibility { LineView(line: Line(icon: "eye", text: tr.t("Zicht \(tr.distance(v))", "Visibility \(tr.distance(v))", "Sicht \(tr.distance(v))"), warn: v < 300), font: .footnote) }
                    }
                    GridRow {
                        LineView(line: Line(icon: "house.fill", text: tr.t("Dal \(temp(w.valleyTemp, tr))", "Valley \(temp(w.valleyTemp, tr))", "Tal \(temp(w.valleyTemp, tr))"), warn: false), font: .footnote)
                        if let f = w.freezing { LineView(line: Line(icon: "thermometer.snowflake", text: tr.t("Vriesgrens \(tr.height(f))", "Freezing level \(tr.height(f))", "Nullgradgrenze \(tr.height(f))"), warn: false), font: .footnote) }
                    }
                }
                if let l = Info.lifts(a, at: entry.date, tr) { LineView(line: l, font: .footnote) }
                if let s = w.sunset { LineView(line: Line(icon: "sunset.fill", text: tr.t("Zon onder \(s)", "Sunset \(s)", "Sonnenuntergang \(s)"), warn: false), font: .footnote) }
                Divider().overlay(Color.white.opacity(0.2))
                forecast(w, tr, count: 3)
            } else {
                Spacer(minLength: 0)
                Text(tr.t("Weer laden…", "Loading weather…", "Wetter wird geladen…")).font(.caption).foregroundStyle(soft)
                if let l = Info.lifts(a, at: entry.date, tr) { LineView(line: l, font: .footnote) }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder func rectangular(_ a: SharedArea, _ tr: Tr) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(a.name).font(.headline).lineLimit(1)
            if let w = entry.weather {
                Label("\(temp(w.topTemp, tr)) · \(tr.t("\(tr.num(w.fresh24)) cm vers", "\(tr.num(w.fresh24)) cm fresh", "\(tr.num(w.fresh24)) cm neu"))", systemImage: WeatherService.symbol(w.code))
            }
            if let w = entry.weather, let al = Info.alert(w, tr) {
                Label(al.text, systemImage: al.icon).lineLimit(1)
            } else if let l = Info.lifts(a, at: entry.date, tr) {
                Label(l.text, systemImage: l.icon).lineLimit(1)
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

struct AreaWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SkipilotArea", provider: AreaProvider()) { entry in
            AreaView(entry: entry).containerBackground(for: .widget) {
                LinearGradient(colors: [navyTop, navy], startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
        .configurationDisplayName("Skigebied")
        .description("Weer, verse sneeuw, liftentijden en waarschuwingen in je skigebied.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline])
    }
}

// ---------- widget: skidag ----------
struct DayEntry: TimelineEntry {
    let date: Date
    let day: SharedDay?
}

struct DayProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry {
        DayEntry(date: Date(), day: SharedDay(date: "", area: "Zillertal Arena", km: 42.5, hm: 6120, runs: 14, lifts: 15, vmax: 71, secs: 15120, lang: nil))
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
            switch family {
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(.headline)
                    Text("\(tr.num(d.km, digits: 1)) km · \(tr.num(d.hm)) \(tr.t("hm", "m vert", "Hm"))")
                    Text("\(d.runs) \(tr.t("afdalingen", "runs", "Abfahrten")) · \(tr.num(d.vmax)) km/h")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .systemMedium:
                HStack(alignment: .top, spacing: 16) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(title).font(.caption.weight(.bold)).foregroundStyle(gold)
                        bigKm(d, tr)
                        Spacer(minLength: 0)
                        if !d.area.isEmpty { Text(d.area).font(.caption2).lineLimit(1).foregroundStyle(soft) }
                    }
                    VStack(alignment: .leading, spacing: 5) {
                        stats(d, tr, all: true)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            default:
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.caption.weight(.bold)).foregroundStyle(gold)
                    bigKm(d, tr)
                    Spacer(minLength: 0)
                    stats(d, tr, all: false)
                }
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

    @ViewBuilder func bigKm(_ d: SharedDay, _ tr: Tr) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(tr.num(d.km, digits: 1)).font(.system(size: 32, weight: .bold, design: .rounded))
            Text("km").font(.caption.weight(.semibold))
        }
        .foregroundStyle(.white)
    }

    @ViewBuilder func stats(_ d: SharedDay, _ tr: Tr, all: Bool) -> some View {
        LineView(line: Line(icon: "arrow.down.right", text: "\(tr.num(d.hm)) \(tr.t("hoogtemeters", "m vertical", "Höhenmeter"))", warn: false))
        LineView(line: Line(icon: "figure.skiing.downhill", text: all ? "\(d.runs) \(tr.t("afdalingen", "runs", "Abfahrten"))" : "\(d.runs) \(tr.t("afd.", "runs", "Abf.")) · \(d.lifts) \(tr.t("liften", "lifts", "Lifte"))", warn: false))
        if all { LineView(line: Line(icon: "cablecar", text: "\(d.lifts) \(tr.t("liften", "lifts", "Lifte"))", warn: false)) }
        LineView(line: Line(icon: "speedometer", text: "\(tr.num(d.vmax)) km/h max", warn: false))
        if let s = d.secs, s > 0 { LineView(line: Line(icon: "clock", text: tr.t("\(tr.duration(minutes: s / 60)) op de piste", "\(tr.duration(minutes: s / 60)) on the slopes", "\(tr.duration(minutes: s / 60)) auf der Piste"), warn: false)) }
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
        .description("Kilometers, hoogtemeters, afdalingen en tijd op de piste van je skidag.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

@main
struct SkipilotWidgets: WidgetBundle {
    var body: some Widget {
        AreaWidget()
        DayWidget()
        if #available(iOS 18.0, *) { NavLiveActivityWatch() } else { NavLiveActivity() }
    }
}
