import WidgetKit
import SwiftUI

// MARK: - Data model

struct MonkWidgetEntry: TimelineEntry {
    let date: Date
    let streak: Int
    let doneCount: Int
    let totalCount: Int
    let personality: String
    let name: String
}

// MARK: - Timeline provider

struct MonkProvider: TimelineProvider {
    func placeholder(in context: Context) -> MonkWidgetEntry {
        MonkWidgetEntry(date: Date(), streak: 12, doneCount: 3, totalCount: 5,
                        personality: "stoic_mentor", name: "Monk")
    }

    func getSnapshot(in context: Context, completion: @escaping (MonkWidgetEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MonkWidgetEntry>) -> Void) {
        let entry = loadEntry()
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func loadEntry() -> MonkWidgetEntry {
        let defaults = UserDefaults(suiteName: "group.com.monk.ai")
        if let jsonString = defaults?.string(forKey: "monk_widget_data"),
           let data = jsonString.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return MonkWidgetEntry(
                date: Date(),
                streak:      json["streak"]      as? Int    ?? 0,
                doneCount:   json["doneCount"]   as? Int    ?? 0,
                totalCount:  json["totalCount"]  as? Int    ?? 0,
                personality: json["personality"] as? String ?? "stoic_mentor",
                name:        json["name"]        as? String ?? "Monk"
            )
        }
        return MonkWidgetEntry(date: Date(), streak: 0, doneCount: 0, totalCount: 0,
                               personality: "stoic_mentor", name: "Monk")
    }
}

// MARK: - Colors

private func accentColor(_ p: String) -> Color {
    switch p {
    case "drill_sergeant": return Color(red: 0.941, green: 0.376, blue: 0.376)
    case "stoic_mentor":   return Color(red: 0.722, green: 0.941, blue: 0.345)
    case "anime_sensei":   return Color(red: 0.482, green: 0.416, blue: 0.941)
    case "goggins":        return Color(red: 0.961, green: 0.784, blue: 0.251)
    case "ceo_coach":      return Color(red: 0.251, green: 0.961, blue: 0.784)
    case "calm_therapist": return Color(red: 0.941, green: 0.627, blue: 0.376)
    default:               return Color(red: 0.722, green: 0.941, blue: 0.345)
    }
}

private let bg = Color(red: 0.039, green: 0.039, blue: 0.039)

// MARK: - Small widget (streak + habit dots)

struct MonkSmallView: View {
    let entry: MonkWidgetEntry
    var accent: Color { accentColor(entry.personality) }

    var body: some View {
        ZStack(alignment: .topLeading) {
            bg
            Rectangle().fill(accent).frame(height: 2).frame(maxWidth: .infinity)

            VStack(alignment: .leading, spacing: 0) {
                Spacer()
                Text("\(entry.streak)")
                    .font(.system(size: 52, weight: .heavy, design: .default))
                    .foregroundColor(.white)
                    .minimumScaleFactor(0.4)
                    .lineLimit(1)
                Text("DAY STREAK")
                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                    .foregroundColor(Color(white: 0.38))
                    .kerning(1.4)
                Spacer()
                if entry.totalCount > 0 {
                    HStack(spacing: 4) {
                        ForEach(0..<min(entry.totalCount, 7), id: \.self) { i in
                            Circle()
                                .fill(i < entry.doneCount ? accent : Color(white: 0.14))
                                .frame(width: 7, height: 7)
                        }
                    }
                }
            }
            .padding(14)
        }
    }
}

// MARK: - Medium widget (streak + habit progress bar)

struct MonkMediumView: View {
    let entry: MonkWidgetEntry
    var accent: Color { accentColor(entry.personality) }
    var allDone: Bool { entry.totalCount > 0 && entry.doneCount >= entry.totalCount }

    var body: some View {
        ZStack(alignment: .top) {
            bg
            Rectangle().fill(accent).frame(height: 2).frame(maxWidth: .infinity)

            HStack(spacing: 0) {
                // Left: streak
                VStack(alignment: .leading, spacing: 2) {
                    Spacer()
                    Text("\(entry.streak)")
                        .font(.system(size: 48, weight: .heavy))
                        .foregroundColor(.white)
                        .minimumScaleFactor(0.4)
                        .lineLimit(1)
                    Text("DAY\nSTREAK")
                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                        .foregroundColor(Color(white: 0.38))
                        .kerning(1.2)
                        .lineLimit(2)
                    Spacer()
                }
                .padding(.leading, 16)
                .frame(maxWidth: .infinity, alignment: .leading)

                Rectangle()
                    .fill(Color(white: 0.10))
                    .frame(width: 1)
                    .padding(.vertical, 18)

                // Right: habits
                VStack(alignment: .leading, spacing: 8) {
                    Text("TODAY")
                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                        .foregroundColor(Color(white: 0.30))
                        .kerning(1.4)

                    Text(entry.totalCount == 0 ? "—" : "\(entry.doneCount)/\(entry.totalCount)")
                        .font(.system(size: 30, weight: .heavy))
                        .foregroundColor(allDone ? accent : .white)

                    Text(allDone ? "all done" : "habits done")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(allDone ? accent.opacity(0.7) : Color(white: 0.38))

                    if entry.totalCount > 0 {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color(white: 0.12))
                                    .frame(height: 4)
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(accent)
                                    .frame(
                                        width: geo.size.width * CGFloat(entry.doneCount) / CGFloat(max(entry.totalCount, 1)),
                                        height: 4
                                    )
                            }
                        }
                        .frame(height: 4)
                    }
                }
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: - Entry view dispatcher

struct MonkWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: MonkWidgetEntry

    var body: some View {
        switch family {
        case .systemMedium: MonkMediumView(entry: entry)
        default:            MonkSmallView(entry: entry)
        }
    }
}

// MARK: - Widget definition

struct MonkWidget: Widget {
    let kind = "MonkWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MonkProvider()) { entry in
            MonkWidgetEntryView(entry: entry)
                .containerBackground(bg, for: .widget)
        }
        .configurationDisplayName("Monk.ai")
        .description("Your streak and today's habits.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
