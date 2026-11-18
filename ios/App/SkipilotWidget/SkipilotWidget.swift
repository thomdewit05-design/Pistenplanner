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
        self.lang = ["nl", "en", "de", "fr", "it", "es", "pt", "ru", "zh", "ja"].contains(l) ? l : "en"
    }
    func t(_ nl: String, _ en: String, _ de: String, fr: String? = nil, it: String? = nil) -> String {
        switch lang { case "nl": return nl; case "de": return de; case "fr": return fr ?? en; case "it": return it ?? en; default: return en }
    }
    var locale: Locale { Locale(identifier: ["nl": "nl_NL", "de": "de_DE", "fr": "fr_FR", "it": "it_IT", "es": "es_ES", "pt": "pt_BR", "ru": "ru_RU", "zh": "zh_CN", "ja": "ja_JP"][lang] ?? "en_GB") }
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

    // voor de liftbalk: tekst links, tekst rechts en hoe ver de dag is (0 tot 1)
    struct LiftState { let left: String; let right: String; let progress: Double; let warn: Bool }
    static func liftState(_ a: SharedArea, at date: Date, _ tr: Tr) -> LiftState? {
        guard let o = a.open, let c = a.close, let om = minutes(o), let cm = minutes(c), cm > om else { return nil }
        let hm = Calendar.current.dateComponents([.hour, .minute], from: date)
        let now = (hm.hour ?? 0) * 60 + (hm.minute ?? 0)
        if now < om { return LiftState(left: tr.t("Open om \(o)", "Open at \(o)", "Öffnet \(o)"), right: c, progress: 0, warn: false) }
        if now >= cm { return LiftState(left: tr.t("Liften dicht", "Lifts closed", "Lifte zu"), right: tr.t("morgen \(o)", "tomorrow \(o)", "morgen \(o)"), progress: 1, warn: false) }
        let p = Double(now - om) / Double(cm - om)
        return LiftState(left: tr.t("Nog \(tr.duration(minutes: cm - now))", "\(tr.duration(minutes: cm - now)) left", "Noch \(tr.duration(minutes: cm - now))"),
                         right: tr.t("tot \(c)", "until \(c)", "bis \(c)"), progress: min(1, max(0, p)), warn: cm - now <= 30)
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

// ---------- vormgeving: lucht, bergen, tegels ----------
// Eén stijl voor alle widgets: een lucht die meekleurt met het weer en het uur, een bergsilhouet onderin,
// grote ronde cijfers en rustige tegels in plaats van regels tekst.
func rgb(_ r: Double, _ g: Double, _ b: Double) -> Color { Color(red: r / 255, green: g / 255, blue: b / 255) }

struct Ridge: Shape {
    let pts: [CGFloat]   // hoogtes tussen 0 en 1, gelijk verdeeld over de breedte
    func path(in r: CGRect) -> Path {
        var p = Path()
        let n = CGFloat(max(1, pts.count - 1))
        p.move(to: CGPoint(x: r.minX, y: r.maxY))
        for (i, h) in pts.enumerated() {
            p.addLine(to: CGPoint(x: r.minX + r.width * CGFloat(i) / n, y: r.maxY - r.height * h))
        }
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

struct Sky: View {
    var code: Int? = nil
    var date: Date = Date()
    var colors: [Color]? = nil

    static func palette(_ code: Int?, _ date: Date) -> [Color] {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        let h = Double(c.hour ?? 12) + Double(c.minute ?? 0) / 60
        if h >= 21.5 || h < 5 { return [rgb(9, 20, 44), rgb(27, 46, 92)] }          // nacht
        if h >= 18.5 { return [rgb(74, 52, 128), rgb(24, 36, 84)] }                 // schemering
        if let k = code, (45...48).contains(k) || k >= 51 { return [rgb(74, 92, 122), rgb(138, 156, 184)] }   // mist, regen, sneeuw
        if code == 3 { return [rgb(62, 98, 150), rgb(128, 158, 198)] }              // bewolkt
        if h < 8 { return [rgb(232, 150, 110), rgb(92, 138, 206)] }                 // ochtend
        if h >= 16 { return [rgb(236, 158, 84), rgb(84, 108, 182)] }                // gouden uur
        return [rgb(26, 104, 214), rgb(104, 170, 240)]                              // heldere dag
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            LinearGradient(colors: colors ?? Sky.palette(code, date), startPoint: .top, endPoint: .bottom)
            Ridge(pts: [0.30, 0.52, 0.40, 0.78, 0.55, 0.92, 0.60, 0.74, 0.44, 0.58, 0.34])
                .fill(Color.white.opacity(0.13)).frame(height: 78)
            Ridge(pts: [0.55, 0.36, 0.62, 0.42, 0.30, 0.50, 0.78, 0.52, 0.66, 0.40, 0.60])
                .fill(navy.opacity(0.30)).frame(height: 50)
        }
    }
}

// klein etiket met pictogram: licht (op de lucht) of gevuld (valt op)
struct Chip: View {
    let icon: String
    let text: String
    var strong = false
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 10, weight: .bold))
            Text(text).font(.system(size: 11, weight: .bold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.7)
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .foregroundStyle(strong ? navy : Color.white)
        .background(strong ? Color.white.opacity(0.94) : Color.white.opacity(0.18), in: Capsule())
    }
}

// tegel met een waarde en een bijschrift
struct Tile: View {
    let icon: String
    let value: String
    let label: String
    var warn = false
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Image(systemName: icon).font(.system(size: 11, weight: .bold)).opacity(0.85)
            Text(value).font(.system(size: 16, weight: .bold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.system(size: 10, weight: .semibold)).opacity(0.78).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 9).padding(.vertical, 6)
        .foregroundStyle(warn ? navy : Color.white)
        .background(warn ? gold.opacity(0.95) : Color.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

// balk met de liftentijd: hoe ver de skidag is, en hoe lang de liften nog open zijn
struct LiftBar: View {
    let area: SharedArea
    let date: Date
    let tr: Tr
    var body: some View {
        if let st = Info.liftState(area, at: date, tr) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 4) {
                    Image(systemName: "cablecar.fill").font(.system(size: 10, weight: .bold))
                    Text(st.left).lineLimit(1).minimumScaleFactor(0.7)
                    Spacer(minLength: 2)
                    Text(st.right).opacity(0.8).lineLimit(1)
                }
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(st.warn ? gold : Color.white)
                ProgressView(value: st.progress).progressViewStyle(.linear).tint(st.warn ? gold : Color.white).scaleEffect(x: 1, y: 0.7, anchor: .center)
            }
        }
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
            case .accessoryCircular: circular(a, tr)
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

    func freshText(_ w: Weather, _ tr: Tr) -> String {
        tr.t("\(tr.num(w.fresh24)) cm vers", "\(tr.num(w.fresh24)) cm fresh", "\(tr.num(w.fresh24)) cm neu")
    }

    // kop: naam van het gebied in kleine kapitalen, weerpictogram rechts
    @ViewBuilder func header(_ a: SharedArea, _ w: Weather?) -> some View {
        HStack(alignment: .top, spacing: 4) {
            Text(a.name.uppercased()).font(.system(size: 10.5, weight: .heavy)).tracking(0.7)
                .lineLimit(1).minimumScaleFactor(0.7).foregroundStyle(Color.white.opacity(0.92))
            Spacer(minLength: 2)
            if let w = w { Image(systemName: WeatherService.symbol(w.code)).symbolRenderingMode(.multicolor).font(.system(size: 19)) }
        }
    }

    @ViewBuilder func small(_ a: SharedArea, _ tr: Tr) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            header(a, entry.weather)
            if let w = entry.weather {
                Text(temp(w.topTemp, tr)).font(.system(size: 40, weight: .semibold, design: .rounded))
                    .lineLimit(1).minimumScaleFactor(0.6).foregroundStyle(Color.white).widgetAccentable()
                Spacer(minLength: 2)
                if let al = Info.alert(w, tr), w.fresh24 < 15 {
                    Chip(icon: al.icon, text: al.text, strong: true)
                } else {
                    Chip(icon: "snowflake", text: freshText(w, tr), strong: w.fresh24 >= 1)
                }
                LiftBar(area: a, date: entry.date, tr: tr).padding(.top, 6)
            } else {
                Spacer(minLength: 0)
                Text(tr.t("Weer laden…", "Loading weather…", "Wetter wird geladen…")).font(.caption.weight(.semibold)).foregroundStyle(Color.white.opacity(0.85))
                Spacer(minLength: 0)
                LiftBar(area: a, date: entry.date, tr: tr)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    // de komende dagen als kolommen in een paneel
    @ViewBuilder func forecast(_ w: Weather, _ tr: Tr, count: Int, compact: Bool = false) -> some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(w.days.prefix(count), id: \.date) { d in
                VStack(spacing: 3) {
                    Text(tr.weekday(d.date).uppercased()).font(.system(size: 10, weight: .heavy)).tracking(0.5).opacity(0.85)
                    Image(systemName: WeatherService.symbol(d.code)).symbolRenderingMode(.multicolor).font(.system(size: 17)).frame(height: 22)
                    Text(temp(d.max, tr)).font(.system(size: 15, weight: .bold, design: .rounded))
                    if !compact { Text(temp(d.min, tr)).font(.system(size: 11, weight: .semibold, design: .rounded)).opacity(0.7) }
                    Text(d.snow >= 1 ? "\(tr.num(d.snow)) cm" : " ").font(.system(size: 10, weight: .heavy, design: .rounded))
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .foregroundStyle(navy)
                        .background(Color.white.opacity(d.snow >= 1 ? 0.94 : 0), in: Capsule())
                }
                .frame(maxWidth: .infinity)
            }
        }
        .foregroundStyle(Color.white)
        .padding(.vertical, 7).padding(.horizontal, 4)
        .background(Color.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    @ViewBuilder func medium(_ a: SharedArea, _ tr: Tr) -> some View {
        HStack(spacing: 12) {
            small(a, tr)
            if let w = entry.weather {
                VStack(spacing: 6) {
                    forecast(w, tr, count: 3, compact: true)
                    HStack(spacing: 6) {
                        Chip(icon: "house.fill", text: tr.t("Dal \(temp(w.valleyTemp, tr))", "Valley \(temp(w.valleyTemp, tr))", "Tal \(temp(w.valleyTemp, tr))"))
                        if let s = w.sunset { Chip(icon: "sunset.fill", text: s) }
                        Spacer(minLength: 0)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        }
    }

    @ViewBuilder func large(_ a: SharedArea, _ tr: Tr) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.name.uppercased()).font(.system(size: 11, weight: .heavy)).tracking(0.8).lineLimit(1).minimumScaleFactor(0.7).foregroundStyle(Color.white.opacity(0.92))
                    if let w = entry.weather {
                        Text(WeatherService.describe(w.code, tr)).font(.system(size: 19, weight: .bold, design: .rounded)).foregroundStyle(Color.white).lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                if let w = entry.weather {
                    HStack(spacing: 6) {
                        Image(systemName: WeatherService.symbol(w.code)).symbolRenderingMode(.multicolor).font(.system(size: 28))
                        Text(temp(w.topTemp, tr)).font(.system(size: 38, weight: .semibold, design: .rounded)).foregroundStyle(Color.white).widgetAccentable()
                    }
                }
            }
            if let w = entry.weather {
                if let al = Info.alert(w, tr) {
                    HStack(spacing: 6) {
                        Image(systemName: al.icon).font(.system(size: 12, weight: .bold))
                        Text(al.text).font(.system(size: 12, weight: .bold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.7)
                        Spacer(minLength: 0)
                    }
                    .foregroundStyle(navy).padding(.horizontal, 10).padding(.vertical, 7)
                    .background(gold.opacity(0.96), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                HStack(spacing: 6) {
                    Tile(icon: "snowflake", value: "\(tr.num(w.fresh24)) cm", label: tr.t("vers", "fresh", "Neuschnee"), warn: w.fresh24 >= 15)
                    Tile(icon: "mountain.2.fill", value: w.snowDepth.map { "\(tr.num($0)) cm" } ?? "–", label: tr.t("sneeuw", "snow", "Schnee"))
                    Tile(icon: "wind", value: "\(tr.num(w.wind)) km/h", label: w.gusts.map { "\(tr.t("stoten", "gusts", "Böen")) \(tr.num($0))" } ?? tr.t("wind", "wind", "Wind"), warn: (w.gusts ?? 0) >= 60)
                }
                HStack(spacing: 6) {
                    Tile(icon: "eye", value: w.visibility.map { tr.distance($0) } ?? "–", label: tr.t("zicht", "visibility", "Sicht"), warn: (w.visibility ?? 9999) < 300)
                    Tile(icon: "house.fill", value: temp(w.valleyTemp, tr), label: tr.t("dal", "valley", "Tal"))
                    Tile(icon: "thermometer.snowflake", value: w.freezing.map { tr.height($0) } ?? "–", label: tr.t("vriesgrens", "freezing level", "Nullgrad"))
                }
                LiftBar(area: a, date: entry.date, tr: tr)
                forecast(w, tr, count: 3)
            } else {
                Spacer(minLength: 0)
                Text(tr.t("Weer laden…", "Loading weather…", "Wetter wird geladen…")).font(.caption.weight(.semibold)).foregroundStyle(Color.white.opacity(0.85))
                LiftBar(area: a, date: entry.date, tr: tr)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    // toegangsscherm, breed: temperatuur en gebied, sneeuw, en een balk met de liftentijd (of de waarschuwing van de dag)
    @ViewBuilder func rectangular(_ a: SharedArea, _ tr: Tr) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 5) {
                if let w = entry.weather {
                    Image(systemName: WeatherService.symbol(w.code)).font(.system(size: 15, weight: .semibold))
                    Text(temp(w.topTemp, tr)).font(.system(size: 18, weight: .bold, design: .rounded))
                }
                Text(a.name).font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7).opacity(0.85)
                Spacer(minLength: 0)
            }
            .widgetAccentable()
            if let w = entry.weather {
                Label(snowLine(w, tr).text, systemImage: "snowflake").font(.system(size: 12, weight: .medium)).lineLimit(1).minimumScaleFactor(0.8)
            }
            if let w = entry.weather, let al = Info.alert(w, tr), w.fresh24 < 15 {
                Label(al.text, systemImage: al.icon).font(.system(size: 12, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
            } else if let st = Info.liftState(a, at: entry.date, tr) {
                HStack(spacing: 5) {
                    Image(systemName: "cablecar.fill").font(.system(size: 10, weight: .semibold))
                    ProgressView(value: st.progress).progressViewStyle(.linear)
                    Text(st.progress > 0 && st.progress < 1 ? st.right : st.left).font(.system(size: 11, weight: .semibold, design: .rounded)).lineLimit(1).fixedSize()
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // toegangsscherm, rond: weer, temperatuur en verse sneeuw
    @ViewBuilder func circular(_ a: SharedArea, _ tr: Tr) -> some View {
        ZStack {
            AccessoryWidgetBackground()
            if let w = entry.weather {
                VStack(spacing: -1) {
                    Image(systemName: WeatherService.symbol(w.code)).font(.system(size: 12, weight: .semibold))
                    Text(temp(w.topTemp, tr)).font(.system(size: 17, weight: .bold, design: .rounded)).minimumScaleFactor(0.7).lineLimit(1).widgetAccentable()
                    if w.fresh24 >= 1 { Text("\(tr.num(w.fresh24)) cm").font(.system(size: 9, weight: .heavy, design: .rounded)) }
                }
                .padding(.horizontal, 4)
            } else {
                Image(systemName: "mountain.2.fill").font(.system(size: 18, weight: .semibold))
            }
        }
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
            Image(systemName: "mountain.2.fill").font(.system(size: 24, weight: .bold)).foregroundStyle(Color.white)
            Spacer(minLength: 0)
            Text(tr.t("Open een skigebied in Skipilot", "Open a ski area in Skipilot", "Öffne ein Skigebiet in Skipilot"))
                .font(.system(size: 13, weight: .bold, design: .rounded)).foregroundStyle(Color.white)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct AreaWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SkipilotArea", provider: AreaProvider()) { entry in
            AreaView(entry: entry).widgetURL(URL(string: "skipilot://open/vandaag")).containerBackground(for: .widget) {
                Sky(code: entry.weather?.code, date: entry.date)
            }
        }
        .configurationDisplayName("Skigebied")
        .description("Weer, verse sneeuw, liftentijden en waarschuwingen in je skigebied.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular, .accessoryInline])
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
            case .accessoryCircular:
                Gauge(value: min(d.km, 40), in: 0...40) {
                    Image(systemName: "figure.skiing.downhill")
                } currentValueLabel: {
                    VStack(spacing: -2) {
                        Text(tr.num(d.km, digits: d.km < 10 ? 1 : 0)).font(.system(size: 15, weight: .bold, design: .rounded))
                        Text("km").font(.system(size: 8, weight: .heavy))
                    }
                }
                .gaugeStyle(.accessoryCircularCapacity)
            case .accessoryInline:
                Text("\(Image(systemName: "figure.skiing.downhill")) \(tr.num(d.km, digits: 1)) km · \(tr.num(d.hm)) hm")
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Image(systemName: "figure.skiing.downhill").font(.system(size: 13, weight: .semibold))
                        Text(tr.num(d.km, digits: 1)).font(.system(size: 19, weight: .bold, design: .rounded))
                        Text("km").font(.system(size: 12, weight: .semibold))
                        Spacer(minLength: 0)
                        Text(title).font(.system(size: 11, weight: .semibold)).opacity(0.8).lineLimit(1)
                    }
                    .widgetAccentable()
                    ProgressView(value: min(1, max(0, d.km / 40))).progressViewStyle(.linear)
                    Text("\(tr.num(d.hm)) \(tr.t("hm", "m vert", "Hm")) · \(d.runs) \(tr.t("afd.", "runs", "Abf.")) · \(tr.num(d.vmax)) km/h")
                        .font(.system(size: 12, weight: .medium)).lineLimit(1).minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .systemMedium:
                HStack(spacing: 14) {
                    VStack(spacing: 6) {
                        dayTitle(title)
                        ring(d, tr, size: 88)
                        Spacer(minLength: 0)
                    }
                    .frame(width: 96)
                    VStack(spacing: 6) {
                        HStack(spacing: 6) {
                            Tile(icon: "arrow.down.right", value: tr.num(d.hm), label: tr.t("hoogtemeters", "m vertical", "Höhenmeter"))
                            Tile(icon: "figure.skiing.downhill", value: "\(d.runs)", label: tr.t("afdalingen", "runs", "Abfahrten"))
                        }
                        HStack(spacing: 6) {
                            Tile(icon: "speedometer", value: "\(tr.num(d.vmax))", label: tr.t("km/u top", "km/h top", "km/h max"))
                            if let sec = d.secs, sec > 0 {
                                Tile(icon: "clock", value: tr.duration(minutes: sec / 60), label: tr.t("op de piste", "on the slopes", "auf der Piste"))
                            } else {
                                Tile(icon: "cablecar.fill", value: "\(d.lifts)", label: tr.t("liften", "lifts", "Lifte"))
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            default:
                VStack(spacing: 5) {
                    dayTitle(title)
                    ring(d, tr, size: 74)
                    Spacer(minLength: 0)
                    HStack(spacing: 0) {
                        mini("\(tr.num(d.hm))", tr.t("hm", "m vert", "Hm"))
                        mini("\(d.runs)", tr.t("afd.", "runs", "Abf."))
                        mini("\(tr.num(d.vmax))", "km/h")
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "figure.skiing.downhill").font(.system(size: 24, weight: .bold)).foregroundStyle(Color.white)
                Spacer(minLength: 0)
                Text(tr.t("Start het skidagboek in Skipilot", "Start the ski diary in Skipilot", "Starte das Skitagebuch in Skipilot"))
                    .font(.system(size: 13, weight: .bold, design: .rounded)).foregroundStyle(Color.white)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    @ViewBuilder func dayTitle(_ title: String) -> some View {
        HStack {
            Text(title.uppercased()).font(.system(size: 10.5, weight: .heavy)).tracking(0.7).foregroundStyle(Color.white.opacity(0.92)).lineLimit(1)
            Spacer(minLength: 0)
        }
    }

    // ring die volloopt tot 40 km, met de kilometers erin
    @ViewBuilder func ring(_ d: SharedDay, _ tr: Tr, size: CGFloat) -> some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.2), lineWidth: 8)
            Circle().trim(from: 0, to: CGFloat(min(1, max(0.02, d.km / 40))))
                .stroke(gold, style: StrokeStyle(lineWidth: 8, lineCap: .round)).rotationEffect(.degrees(-90))
            VStack(spacing: -2) {
                Text(tr.num(d.km, digits: d.km < 100 ? 1 : 0)).font(.system(size: size * 0.29, weight: .bold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6).widgetAccentable()
                Text("km").font(.system(size: size * 0.13, weight: .heavy)).opacity(0.8)
            }
            .foregroundStyle(Color.white).padding(.horizontal, 12)
        }
        .frame(width: size, height: size)
    }

    @ViewBuilder func mini(_ value: String, _ label: String) -> some View {
        VStack(spacing: 0) {
            Text(value).font(.system(size: 13, weight: .bold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.system(size: 9, weight: .heavy)).opacity(0.75).lineLimit(1)
        }
        .foregroundStyle(Color.white).frame(maxWidth: .infinity)
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
            DayView(entry: entry).widgetURL(URL(string: "skipilot://open/ik")).containerBackground(for: .widget) {
                Sky(colors: [rgb(16, 44, 96), rgb(38, 96, 178)])
            }
        }
        .configurationDisplayName("Skidag")
        .description("Kilometers, hoogtemeters, afdalingen en tijd op de piste van je skidag.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

// ---------- aftellen naar je skivakantie (reisplanner in de app) ----------
struct SharedTrip: Codable {
    let area: String
    let from: String   // jjjj-mm-dd
    let to: String
    let lang: String?
}
struct TripEntry: TimelineEntry { let date: Date; let trip: SharedTrip? }
struct TripProvider: TimelineProvider {
    func placeholder(in context: Context) -> TripEntry { TripEntry(date: Date(), trip: SharedTrip(area: "Ski Arlberg", from: "2027-02-13", to: "2027-02-20", lang: nil)) }
    func getSnapshot(in context: Context, completion: @escaping (TripEntry) -> Void) {
        let t: SharedTrip? = Shared.read("trip"); completion(t == nil ? placeholder(in: context) : TripEntry(date: Date(), trip: t))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TripEntry>) -> Void) {
        let midnight = Calendar.current.startOfDay(for: Date().addingTimeInterval(86400))
        completion(Timeline(entries: [TripEntry(date: Date(), trip: Shared.read("trip"))], policy: .after(midnight)))
    }
}
struct TripView: View {
    @Environment(\.widgetFamily) var family
    let entry: TripEntry
    func daysLeft(_ iso: String) -> Int? {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: iso) else { return nil }
        return Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()), to: d).day
    }
    var body: some View {
        let tr = Tr(entry.trip?.lang)
        if let t = entry.trip, let n = daysLeft(t.from) {
            let onTrip = n <= 0 && (daysLeft(t.to) ?? 0) >= 0
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: -2) {
                        if onTrip { Image(systemName: "figure.skiing.downhill").font(.system(size: 18, weight: .bold)) }
                        else { Text("\(max(0, n))").font(.system(size: 21, weight: .bold, design: .rounded)).minimumScaleFactor(0.6).lineLimit(1).widgetAccentable() }
                        Text(onTrip ? tr.t("nu", "now", "jetzt") : (n == 1 ? tr.t("dag", "day", "Tag") : tr.t("dagen", "days", "Tage"))).font(.system(size: 9, weight: .heavy))
                    }
                    .padding(.horizontal, 4)
                }
            case .accessoryRectangular:
                HStack(spacing: 8) {
                    if onTrip { Image(systemName: "figure.skiing.downhill").font(.system(size: 26, weight: .bold)).widgetAccentable() }
                    else { Text("\(max(0, n))").font(.system(size: 32, weight: .bold, design: .rounded)).minimumScaleFactor(0.6).lineLimit(1).widgetAccentable() }
                    VStack(alignment: .leading, spacing: 1) {
                        Text(onTrip ? tr.t("Je bent op skivakantie!", "You're on your ski trip!", "Du bist im Skiurlaub!") : (n == 1 ? tr.t("dag tot", "day until", "Tag bis") : tr.t("dagen tot", "days until", "Tage bis")))
                            .font(.system(size: 11, weight: .semibold)).opacity(0.8).lineLimit(1).minimumScaleFactor(0.7)
                        Text(t.area).font(.system(size: 14, weight: .bold)).lineLimit(1).minimumScaleFactor(0.7)
                        if let r = range(t, tr) { Text(r).font(.system(size: 11, weight: .medium)).opacity(0.8).lineLimit(1) }
                    }
                    Spacer(minLength: 0)
                }
            case .accessoryInline:
                Text("\(Image(systemName: "snowflake")) \(onTrip ? t.area : "\(n) \(tr.t("dagen tot", "days to", "Tage bis")) \(t.area)")")
            default:
                VStack(alignment: .leading, spacing: 0) {
                    Text((onTrip ? tr.t("Op vakantie", "On holiday", "Im Urlaub") : tr.t("Nog", "Only", "Noch")).uppercased())
                        .font(.system(size: 10.5, weight: .heavy)).tracking(0.7).foregroundStyle(Color.white.opacity(0.92))
                    HStack(alignment: .firstTextBaseline, spacing: 5) {
                        Text(onTrip ? "⛷" : "\(max(0, n))").font(.system(size: 44, weight: .semibold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6).foregroundStyle(Color.white).widgetAccentable()
                        if !onTrip { Text(n == 1 ? tr.t("dag", "day", "Tag") : tr.t("dagen", "days", "Tage")).font(.system(size: 13, weight: .bold, design: .rounded)).foregroundStyle(Color.white.opacity(0.9)) }
                    }
                    Spacer(minLength: 2)
                    Text(t.area).font(.system(size: 13, weight: .bold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.7).foregroundStyle(Color.white)
                    if let r = range(t, tr) { Chip(icon: "calendar", text: r).padding(.top, 5) }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "calendar").font(.system(size: 24, weight: .bold)).foregroundStyle(Color.white)
                Spacer(minLength: 0)
                Text(tr.t("Plan je skivakantie in Skipilot", "Plan your ski trip in Skipilot", "Plane deinen Skiurlaub in Skipilot")).font(.system(size: 13, weight: .bold, design: .rounded)).foregroundStyle(Color.white)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    // "13 feb – 20 feb"
    func range(_ t: SharedTrip, _ tr: Tr) -> String? {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let a = f.date(from: t.from), let b = f.date(from: t.to) else { return nil }
        let style = Date.FormatStyle.dateTime.day().month(.abbreviated).locale(tr.locale)
        return "\(a.formatted(style)) – \(b.formatted(style))"
    }
}
struct TripWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SkipilotTrip", provider: TripProvider()) { entry in
            TripView(entry: entry).widgetURL(URL(string: "skipilot://open/plannen")).containerBackground(for: .widget) {
                Sky(colors: [rgb(92, 58, 214), rgb(40, 132, 226)])
            }
        }
        .configurationDisplayName("Skivakantie")
        .description("Aftellen naar je skivakantie.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct SkipilotWidgets: WidgetBundle {
    var body: some Widget {
        AreaWidget()
        DayWidget()
        NavLiveActivity()
        DayLiveActivity()
        TripWidget()
    }
}
