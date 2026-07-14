#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MonkWidgetBridge, NSObject)
RCT_EXTERN_METHOD(updateWidgetData:(NSDictionary *)data)
@end
