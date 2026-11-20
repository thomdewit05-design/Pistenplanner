import SwiftUI
import WidgetKit

// Skipilot op de wijzerplaat en in de Smart Stack. Tijdens het navigeren: de volgende afslag met de afstand.
// Anders: de kilometers van vandaag. De gegevens komen uit de momentopname die de Watch-app bewaart (Snapshot.swift).

struct SnapEntry: TimelineEntry { let date: Date; let snap: WatchSnapshot }

struct SnapProvider: TimelineProvider {
    func placeholder(in context: Context) -> SnapEntry { SnapEntry(date: Date(), snap: sample) }
    func getSnapshot(in context: Context, completion: @escaping (SnapEntry) -> Void) {
        completion(SnapEntry(date: Date(), snap: context.isPreview ? sample : WatchSnapshot.load()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapEntry>) -> Void) {
        let now = Date(), s = WatchSnapshot.load()
        var entries = [SnapEntry(date: now, snap: s)]
        // een afslag die niet meer wordt bijgewerkt, verdwijnt na een kwartier vanzelf
        if let at = s.navAt, s.navigating(now) { entries.append(SnapEntry(date: at.addingTimeInterval(15 * 60 + 1), snap: s)) }
        // om middernacht verdwijnt de skidag van gisteren
        if s.hasDay(now), let mid = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0, minute: 0, second: 5), matchingPolicy: .nextTime) {
            entries.append(SnapEntry(date: mid, snap: s))
        }
        completion(Timeline(entries: entries.sorted { $0.date < $1.date }, policy: .after(now.addingTimeInterval(30 * 60))))
    }
    private var sample: WatchSnapshot {
        var s = WatchSnapshot(); s.navAt = Date(); s.dist = 350; s.instruction = "Piste 12"; s.turn = "right"
        s.dayAt = Date(); s.km = 31.4; s.hm = 6200; s.runs = 17; return s
    }
}

struct ComplicationView: View {
    @Environment(\.widgetFamily) var family
    let entry: SnapEntry
    var body: some View {
        let s = entry.snap, nav = s.navigating(entry.date), day = s.hasDay(entry.date)
        Group {
            switch family {
            case .accessoryRectangular: rectangular(s, nav, day)
            case .accessoryInline: inline(s, nav, day)
            case .accessoryCorner: corner(s, nav, day)
            default: circular(s, nav, day)
            }
        }
        .containerBackground(.clear, for: .widget)
    }

    @ViewBuilder func circular(_ s: WatchSnapshot, _ nav: Bool, _ day: Bool) -> some View {
        ZStack {
            AccessoryWidgetBackground()
            if nav {
                VStack(spacing: 0) {
                    Image(systemName: s.arrived ? "flag.checkered" : snapTurnSymbol(s.turn)).font(.system(size: 17, weight: .bold)).widgetAccentable()
                    Text(s.arrived ? "✓" : shortDist(s.dist)).font(.system(size: 11, weight: .semibold, design: .rounded)).minimumScaleFactor(0.6).lineLimit(1)
                }
            } else if day {
                VStack(spacing: -1) {
                    Text(String(format: s.km >= 100 ? "%.0f" : "%.1f", s.km)).font(.system(size: 16, weight: .bold, design: .rounded)).minimumScaleFactor(0.6).lineLimit(1).widgetAccentable()
                    Text("km").font(.system(size: 9, weight: .semibold))
                }
            } else {
                Image(systemName: "figure.skiing.downhill").font(.system(size: 20, weight: .semibold)).widgetAccentable()
            }
        }
    }

    @ViewBuilder func rectangular(_ s: WatchSnapshot, _ nav: Bool, _ day: Bool) -> some View {
        HStack(spacing: 6) {
            if nav {
                Image(systemName: s.arrived ? "flag.checkered" : snapTurnSymbol(s.turn)).font(.system(size: 24, weight: .bold)).widgetAccentable().frame(width: 30)
                VStack(alignment: .leading, spacing: 0) {
                    Text(s.arrived ? "✓" : snapDistText(s.dist)).font(.system(size: 17, weight: .bold, design: .rounded))
                    Text(s.instruction).font(.system(size: 12)).lineLimit(2).minimumScaleFactor(0.8)
                }
            } else if day {
                Image(systemName: "figure.skiing.downhill").font(.system(size: 22, weight: .semibold)).widgetAccentable().frame(width: 30)
                VStack(alignment: .leading, spacing: 0) {
                    Text(String(format: "%.1f km", s.km)).font(.system(size: 17, weight: .bold, design: .rounded))
                    Text("\(s.hm) m ↓ · \(s.runs) \(L("afdalingen"))").font(.system(size: 12)).lineLimit(1).minimumScaleFactor(0.7)
                }
            } else {
                Image(systemName: "figure.skiing.downhill").font(.system(size: 22, weight: .semibold)).widgetAccentable().frame(width: 30)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Skipilot").font(.system(size: 16, weight: .bold, design: .rounded))
                    Text(L("Start een route op je iPhone")).font(.system(size: 11)).lineLimit(2).minimumScaleFactor(0.8)
                }
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder func inline(_ s: WatchSnapshot, _ nav: Bool, _ day: Bool) -> some View {
        if nav { Label(s.arrived ? s.instruction : "\(snapDistText(s.dist)) · \(s.instruction)", systemImage: s.arrived ? "flag.checkered" : snapTurnSymbol(s.turn)) }
        else if day { Label(String(format: "%.1f km · %d m ↓", s.km, s.hm), systemImage: "figure.skiing.downhill") }
        else { Label("Skipilot", systemImage: "figure.skiing.downhill") }
    }

    @ViewBuilder func corner(_ s: WatchSnapshot, _ nav: Bool, _ day: Bool) -> some View {
        Image(systemName: nav ? (s.arrived ? "flag.checkered" : snapTurnSymbol(s.turn)) : "figure.skiing.downhill")
            .font(.system(size: 20, weight: .bold)).widgetAccentable()
            .widgetLabel { Text(nav ? (s.arrived ? "✓" : snapDistText(s.dist)) : day ? String(format: "%.1f km", s.km) : "Skipilot") }
    }

    func shortDist(_ m: Double) -> String { m >= 1000 ? String(format: "%.1fkm", m / 1000) : "\(Int((m / 10).rounded() * 10))m" }
}

@main
struct SkipilotComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WatchSnapshot.kind, provider: SnapProvider()) { entry in
            // de taal volgt de iPhone-app, net als in de Watch-app zelf
            let _ = (Strings.lang = Strings.supported.contains(entry.snap.lang) ? entry.snap.lang : Strings.lang)
            ComplicationView(entry: entry)
        }
        .configurationDisplayName("Skipilot")
        .description(L("Start een route op je iPhone"))
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}
