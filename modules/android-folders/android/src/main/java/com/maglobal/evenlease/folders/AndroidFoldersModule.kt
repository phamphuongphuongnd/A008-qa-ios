package com.maglobal.evenlease.folders

import android.net.Uri
import android.provider.DocumentsContract
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * B-102: the picked backup folder's real name. expo-file-system's Directory.name is the last part of the uri — for
 * Google Drive that is a document id ("acc=6;doc=encoded=…"). The provider's COLUMN_DISPLAY_NAME is the folder name.
 */
class AndroidFoldersModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EvenleaseAndroidFolders")

    Function("displayName") { treeUri: String ->
      try {
        val context = appContext.reactContext ?: return@Function null
        val tree = Uri.parse(treeUri)
        val docId = if (DocumentsContract.isDocumentUri(context, tree)) {
          DocumentsContract.getDocumentId(tree)
        } else {
          DocumentsContract.getTreeDocumentId(tree)
        }
        val doc = DocumentsContract.buildDocumentUriUsingTree(tree, docId)
        context.contentResolver.query(doc, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { c ->
          if (c.moveToFirst() && !c.isNull(0)) c.getString(0)?.takeIf { it.isNotBlank() } else null
        }
      } catch (e: Exception) {
        null
      }
    }
  }
}
