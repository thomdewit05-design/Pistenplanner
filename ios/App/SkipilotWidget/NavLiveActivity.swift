import ActivityKit
import WidgetKit
import SwiftUI

// Navigatie op het toegangsscherm en in het Dynamic Island. De gegevens komen van NavPlugin in de app
// (die rekent ook op de achtergrond met de GPS); NavAttributes staat in App/NavAttributes.swift.
extension Color {
    init?(hex: String?) {
        guard let h = hex, h.hasPrefix("#"), h.count == 7, let v = UInt32(h.dropFirst(), radix: 16) else { return nil }
        self.init(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
    }
}

struct NavBadge: View {
    let state: NavAttributes.ContentState
    var body: some View {
        if let b = state.badge, !b.isEmpty {
            Text(b).font(.caption2.weight(.heavy)).foregroundStyle(.white)
                .padding(.horizontal, 5).padding(.vertical, 1)
                .background(Color(hex: state.color) ?? .gray, in: RoundedRectangle(cornerRadius: 4))
        }
    }
}

struct NavLockView: View {
    let state: NavAttributes.ContentState
    let attr: NavAttributes
    var body: some View {
        let tr = Tr(attr.lang)
        HStack(spacing: 14) {
            Image(systemName: state.icon).font(.system(size: 34, weight: .bold)).foregroundStyle(gold).frame(width: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(state.arrived ? tr.t("Je bent er", "You have arrived", "Du bist da") : tr.distance(state.dist))
                    .font(.system(size: 28, weight: .bold, design: .rounded)).foregroundStyle(.white)
                Text(state.instruction).font(.headline).lineLimit(1).minimumScaleFactor(0.8).foregroundStyle(.white.opacity(0.92))
                HStack(spacing: 6) {
                    NavBadge(state: state)
                    Text(state.current).font(.caption).lineLimit(1).foregroundStyle(soft)
                }
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 2) {
                Text(state.eta, style: .time).font(.headline.monospacedDigit()).foregroundStyle(gold)
                Text(tr.t("aankomst", "arrival", "Ankunft")).font(.caption2).foregroundStyle(soft)
            }
        }
        .padding(16)
    }
}

struct NavLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: NavAttributes.self) { ctx in
            NavLockView(state: ctx.state, attr: ctx.attributes)
                .activityBackgroundTint(navy)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { ctx in
            let tr = Tr(ctx.attributes.lang), s = ctx.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: s.icon).font(.system(size: 30, weight: .bold)).foregroundStyle(gold).padding(.leading, 6)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(s.arrived ? "✓" : tr.distance(s.dist)).font(.title2.weight(.bold)).foregroundStyle(.white).padding(.trailing, 6)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(s.instruction).font(.headline).lineLimit(1).minimumScaleFactor(0.8).foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 6) {
                        NavBadge(state: s)
                        Text(s.current).lineLimit(1)
                        Spacer(minLength: 0)
                        Text(tr.t("aankomst", "arrival", "Ankunft"))
                        Text(s.eta, style: .time).foregroundStyle(gold)
                    }
                    .font(.caption).foregroundStyle(soft)
                }
            } compactLeading: {
                Image(systemName: s.icon).foregroundStyle(gold)
            } compactTrailing: {
                Text(tr.distance(s.dist)).font(.caption.weight(.semibold)).monospacedDigit()
            } minimal: {
                Image(systemName: s.icon).foregroundStyle(gold)
            }
            .keylineTint(gold)
        }
    }
}
