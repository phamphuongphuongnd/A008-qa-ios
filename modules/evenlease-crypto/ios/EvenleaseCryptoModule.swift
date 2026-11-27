import CommonCrypto
import ExpoModulesCore
import Foundation

/**
 * PBKDF2-HMAC-SHA256 for the backup password (B-101) with CommonCrypto — same bytes in, same key out as @noble/hashes
 * in JS (old files stay readable). AsyncFunction runs on the module's queue, off the JS thread.
 */
public class EvenleaseCryptoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("EvenleaseCrypto")

    AsyncFunction("pbkdf2Sha256") { (passwordHex: String, saltHex: String, iterations: Int, keyLength: Int) throws -> String in
      guard iterations >= 1, iterations <= Int(UInt32.max), keyLength >= 1, keyLength <= 1024 else {
        throw Exception(name: "BadArgs", description: "bad iterations or key length")
      }
      guard let password = Self.bytes(passwordHex), let salt = Self.bytes(saltHex) else {
        throw Exception(name: "BadHex", description: "bad hex")
      }
      var out = [UInt8](repeating: 0, count: keyLength)
      let status = password.withUnsafeBytes { pw in
        salt.withUnsafeBufferPointer { s in
          CCKeyDerivationPBKDF(
            CCPBKDFAlgorithm(kCCPBKDF2),
            pw.baseAddress?.assumingMemoryBound(to: CChar.self), password.count,
            s.baseAddress, salt.count,
            CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), UInt32(iterations),
            &out, keyLength)
        }
      }
      guard Int(status) == kCCSuccess else {
        throw Exception(name: "Pbkdf2Failed", description: "CCKeyDerivationPBKDF \(status)")
      }
      return out.map { String(format: "%02x", $0) }.joined()
    }
  }

  private static func bytes(_ hex: String) -> [UInt8]? {
    let chars = Array(hex.utf8)
    guard chars.count % 2 == 0 else { return nil }
    var out = [UInt8]()
    out.reserveCapacity(chars.count / 2)
    var i = 0
    while i < chars.count {
      guard let v = UInt8(String(decoding: chars[i..<i + 2], as: UTF8.self), radix: 16) else { return nil }
      out.append(v)
      i += 2
    }
    return out
  }
}
