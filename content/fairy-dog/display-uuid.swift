import ColorSync
import CoreGraphics
import Foundation

let uuid = CGDisplayCreateUUIDFromDisplayID(CGMainDisplayID())!.takeRetainedValue()
print(CFUUIDCreateString(nil, uuid)! as String)
