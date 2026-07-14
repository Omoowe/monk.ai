import Foundation
import WidgetKit

@objc(MonkWidgetBridge)
class MonkWidgetBridge: NSObject {

  @objc
  func updateWidgetData(_ data: NSDictionary) {
    guard let jsonData = try? JSONSerialization.data(withJSONObject: data),
          let jsonString = String(data: jsonData, encoding: .utf8) else { return }
    let defaults = UserDefaults(suiteName: "group.com.monk.ai")
    defaults?.set(jsonString, forKey: "monk_widget_data")
    defaults?.synchronize()
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
