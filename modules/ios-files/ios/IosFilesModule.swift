import ExpoModulesCore
import Foundation

/**
 * iOS only.
 * - G-05: applicant files and the database stay out of iCloud / computer backups (product.md §10; Android has
 *   allowBackup=false). The flag is set on the folders: everything inside them is excluded.
 * - G-06: the "Automatic backup" folder picked with expo-file-system's Directory.pickDirectoryAsync is a
 *   security-scoped URL that dies with the process; a bookmark (kept in settings) reopens it on every launch and in
 *   the background task. Same design as A006 modules/backup-folder.
 */
public class IosFilesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("EvenleaseIosFiles")

    /** Marks a file or folder (and so everything in it) as not backed up to iCloud / a computer. */
    Function("excludeFromBackup") { (uri: URL) throws in
      var url = uri
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
    }

    Function("isExcludedFromBackup") { (uri: URL) -> Bool in
      let v = try? uri.resourceValues(forKeys: [.isExcludedFromBackupKey])
      return v?.isExcludedFromBackup ?? false
    }

    /** Call right after the picker returns, while the URL is still in scope. */
    Function("makeBookmark") { (uri: URL) throws -> String in
      let ok = uri.startAccessingSecurityScopedResource()
      defer { if ok { uri.stopAccessingSecurityScopedResource() } }
      let data = try uri.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
      return data.base64EncodedString()
    }

    /** Folder URL + whether the bookmark should be re-made (folder moved / renamed). */
    Function("resolve") { (bookmark: String) throws -> [String: Any] in
      let (url, stale) = try Self.resolve(bookmark)
      return ["uri": url.absoluteString, "stale": stale]
    }

    /** Copy a local file (the backup written to the app's cache) into the folder, replacing a file of that name. */
    AsyncFunction("copyInto") { (bookmark: String, source: URL, name: String) throws in
      try Self.withFolder(bookmark) { folder in
        let target = folder.appendingPathComponent(name)
        var coordError: NSError?
        var copyError: Error?
        NSFileCoordinator().coordinate(writingItemAt: target, options: .forReplacing, error: &coordError) { url in
          do {
            if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
            try FileManager.default.copyItem(at: source, to: url)
          } catch {
            copyError = error
          }
        }
        if let e = coordError ?? copyError { throw e }
      }
    }

    /** File names in the folder (sub-folders left out). */
    AsyncFunction("list") { (bookmark: String) throws -> [String] in
      try Self.withFolder(bookmark) { folder in
        let items = try FileManager.default.contentsOfDirectory(
          at: folder, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles])
        return items.compactMap { u in
          let dir = (try? u.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
          return dir ? nil : u.lastPathComponent
        }
      }
    }

    /** Deletes one file in the folder; a missing file is fine. */
    AsyncFunction("remove") { (bookmark: String, name: String) throws in
      try Self.withFolder(bookmark) { folder in
        let target = folder.appendingPathComponent(name)
        if FileManager.default.fileExists(atPath: target.path) { try FileManager.default.removeItem(at: target) }
      }
    }
  }

  private static func resolve(_ bookmark: String) throws -> (URL, Bool) {
    guard let data = Data(base64Encoded: bookmark) else {
      throw NSError(domain: "IosFiles", code: 1, userInfo: [NSLocalizedDescriptionKey: "Bad bookmark"])
    }
    var stale = false
    let url = try URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)
    return (url, stale)
  }

  private static func withFolder<T>(_ bookmark: String, _ body: (URL) throws -> T) throws -> T {
    let (folder, _) = try resolve(bookmark)
    let ok = folder.startAccessingSecurityScopedResource()
    defer { if ok { folder.stopAccessingSecurityScopedResource() } }
    return try body(folder)
  }
}
