import SwiftUI

// Weer en lifttijden, en je groep. De gegevens komen van de iPhone (watchState() in app.js); de Watch rekent alleen de resterende tijd uit.

func durText(_ minutes: Int) -> String {
    minutes >= 60 ? "\(minutes / 60) \(L("u")) \(minutes % 60) \(L("min"))" : "\(minutes) \(L("min"))"
}
func compassText(_ deg: Double) -> String {
    let n = L("N"), e = L("O"), s = L("Z"), w = L("W")
    return [n, n + e, e, s + e, s, s + w, w, n + w][Int(((deg + 22.5).truncatingRemainder(dividingBy: 360)) / 45) % 8]
}

struct WeatherView: View {
    @EnvironmentObject var model: WatchModel
    var body: some View {
        if let w = model.wx {
            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    Text(w.area).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                    if w.top != nil || w.dal != nil {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            if let t = w.top { temp(t, L("Top"), big: true) }
                            if let t = w.dal { temp(t, L("Dal"), big: false) }
                            Spacer(minLength: 0)
                        }
                        if !w.text.isEmpty { Text(w.text).font(.system(size: 13)).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.7) }
                    }
                    TimelineView(.periodic(from: .now, by: 30)) { ctx in lifts(w, now: ctx.date) }
                    if let v = w.wind { row("wind", L("Wind"), "\(v) km/h") }
                    if let v = w.snow { row("snowflake", L("Sneeuw komende 24 u"), "\(v) cm") }
                    if let v = w.depth { row("ruler", L("Sneeuwhoogte"), "\(v) cm") }
                }
                .padding(.horizontal, 6)
            }
            .containerBackground(skiNight.gradient, for: .tabView)
        } else {
            VStack(spacing: 8) {
                Image(systemName: "cloud.snow").font(.system(size: 36)).foregroundStyle(skiGold)
                Text(L("Nog geen weer. Open een skigebied op je iPhone.")).font(.system(size: 13)).multilineTextAlignment(.center).foregroundStyle(.secondary)
            }
            .containerBackground(skiNight.gradient, for: .tabView)
        }
    }
    func temp(_ t: Int, _ label: String, big: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("\(t)°").font(.system(size: big ? 38 : 24, weight: .bold, design: .rounded)).monospacedDigit()
            Text(label).font(.system(size: 10)).foregroundStyle(.secondary)
        }
    }
    @ViewBuilder func lifts(_ w: WatchModel.Wx, now: Date) -> some View {
        if let at = w.closeAt {
            let left = Int((at.timeIntervalSince(now) / 60).rounded(.down))
            // alleen de tijd tot sluiten van vandaag; na sluitingstijd (of bij een oud bericht van gisteren) staat er "gesloten"
            if left > 0 && left < 16 * 60 {
                VStack(alignment: .leading, spacing: 0) {
                    Text(L("Liften sluiten over")).font(.system(size: 10)).foregroundStyle(left <= 30 ? .white : .secondary)
                    Text(durText(left)).font(.system(size: 20, weight: .bold, design: .rounded)).monospacedDigit()
                    Text("\(L("Laatste lift om")) \(w.close)").font(.system(size: 10)).foregroundStyle(left <= 30 ? .white : .secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 8).padding(.vertical, 5)
                .background(left <= 30 ? Color.red.opacity(0.85) : Color.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
            } else {
                Label(L("Liften gesloten"), systemImage: "moon.zzz").font(.system(size: 12)).foregroundStyle(.secondary)
            }
        }
    }
    func row(_ icon: String, _ label: String, _ value: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 12, weight: .semibold)).foregroundStyle(skiGold).frame(width: 18)
            Text(label).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.7)
            Spacer(minLength: 2)
            Text(value).font(.system(size: 14, weight: .semibold, design: .rounded)).monospacedDigit()
        }
    }
}

struct GroupView: View {
    @EnvironmentObject var model: WatchModel
    var body: some View {
        if let g = model.group, !g.isEmpty {
            ScrollView {
                VStack(alignment: .leading, spacing: 7) {
                    Text(L("Je groep")).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).textCase(.uppercase)
                    ForEach(g) { m in
                        HStack(spacing: 7) {
                            // de pijl wijst op een kaart met het noorden boven; de windrichting staat erbij
                            Image(systemName: m.brg == nil ? "questionmark" : "location.north.fill")
                                .font(.system(size: 15, weight: .bold)).foregroundStyle(skiGold)
                                .rotationEffect(.degrees(m.brg ?? 0)).frame(width: 22)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(m.name).font(.system(size: 15, weight: .semibold)).lineLimit(1)
                                if let d = m.dist, let b = m.brg {
                                    Text("\(distText(d)) · \(compassText(b))").font(.system(size: 12)).foregroundStyle(.secondary)
                                } else {
                                    Text(L("geen locatie")).font(.system(size: 12)).foregroundStyle(.secondary)
                                }
                            }
                            Spacer(minLength: 0)
                            // hoe lang geleden gezien; in de laatste minuut staat er niets (dan is de plek vers)
                            if let s = m.seen {
                                TimelineView(.periodic(from: .now, by: 30)) { ctx in
                                    let ago = Int(ctx.date.timeIntervalSince(s) / 60)
                                    if ago >= 1 { Text(durText(ago)).font(.system(size: 11)).foregroundStyle(ago >= 10 ? .orange : .secondary).lineLimit(1) }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 6)
            }
            .containerBackground(skiNight.gradient, for: .tabView)
        } else {
            VStack(spacing: 8) {
                Image(systemName: "person.2.fill").font(.system(size: 34)).foregroundStyle(skiGold)
                Text(L(model.group == nil ? "Geen groep. Maak of open een groep op je iPhone." : "Nog niemand in je groep."))
                    .font(.system(size: 13)).multilineTextAlignment(.center).foregroundStyle(.secondary)
            }
            .containerBackground(skiNight.gradient, for: .tabView)
        }
    }
}
