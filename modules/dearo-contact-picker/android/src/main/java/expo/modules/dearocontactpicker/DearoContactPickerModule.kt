package expo.modules.dearocontactpicker

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.provider.ContactsContract.CommonDataKinds.Phone
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PICK_PHONE_REQUEST = 48173

/** Reads only the URI explicitly returned by Android's phone-number picker. */
class DearoContactPickerModule : Module() {
  private var pending: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("DearoContactPicker")

    AsyncFunction("pickPhone") { promise: Promise ->
      if (pending != null) {
        promise.reject("ERR_PICKER_BUSY", "A contact picker is already open.", null)
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      if (activity == null || activity.isFinishing || activity.isDestroyed) {
        promise.reject("ERR_NO_ACTIVITY", "Open Dearo before choosing a contact.", null)
        return@AsyncFunction
      }
      val intent = Intent(Intent.ACTION_PICK).apply {
        setDataAndType(Phone.CONTENT_URI, Phone.CONTENT_TYPE)
      }
      pending = promise
      try {
        activity.startActivityForResult(intent, PICK_PHONE_REQUEST)
      } catch (error: ActivityNotFoundException) {
        pending = null
        promise.reject("ERR_NO_CONTACT_PICKER", "No phone-number picker is available. Add a guest manually or import a file.", error)
      } catch (error: Exception) {
        pending = null
        promise.reject("ERR_PICKER_OPEN", "The contact picker could not open. Try again or add the guest manually.", error)
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { activity, payload ->
      if (payload.requestCode != PICK_PHONE_REQUEST) return@OnActivityResult
      val promise = pending ?: return@OnActivityResult
      pending = null
      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return@OnActivityResult
      }
      val uri = payload.data?.data
      if (uri == null || uri.scheme != "content") {
        promise.reject("ERR_PICKER_RESULT", "The contact picker did not return a readable phone number.", null)
        return@OnActivityResult
      }
      try {
        // Do not reconstruct a URI, query a collection, or request READ_CONTACTS.
        // The result URI carries temporary permission to this selected phone row.
        val projection = arrayOf(Phone.DISPLAY_NAME, Phone.NUMBER, Phone.TYPE, Phone.LABEL)
        activity.contentResolver.query(uri, projection, null, null, null).use { cursor ->
          if (cursor == null || !cursor.moveToFirst()) {
            promise.reject("ERR_EMPTY_PHONE", "The selected phone number could not be read.", null)
          } else {
            val number = cursor.getString(cursor.getColumnIndexOrThrow(Phone.NUMBER))?.trim()
            if (number.isNullOrBlank()) {
              promise.reject("ERR_EMPTY_PHONE", "This contact has no readable phone number.", null)
            } else {
              val nameIndex = cursor.getColumnIndex(Phone.DISPLAY_NAME)
              val typeIndex = cursor.getColumnIndex(Phone.TYPE)
              val labelIndex = cursor.getColumnIndex(Phone.LABEL)
              val name = if (nameIndex >= 0) cursor.getString(nameIndex) else null
              val type = if (typeIndex >= 0) cursor.getInt(typeIndex) else Phone.TYPE_OTHER
              val customLabel = if (labelIndex >= 0) cursor.getString(labelIndex) else null
              val label = Phone.getTypeLabel(activity.resources, type, customLabel).toString()
              promise.resolve(mapOf("name" to (name?.takeIf { it.isNotBlank() } ?: "Unnamed contact"), "phone" to number, "label" to label))
            }
          }
        }
      } catch (error: SecurityException) {
        promise.reject("ERR_CONTACT_ACCESS", "This provider did not grant access to the selected number. Add the guest manually or import a file; Dearo will not request your whole address book.", error)
      } catch (error: Exception) {
        promise.reject("ERR_CONTACT_READ", "The selected phone number could not be read. Try again or add the guest manually.", error)
      }
    }

    OnDestroy {
      pending?.reject("ERR_PICKER_INTERRUPTED", "Contact selection was interrupted. Please try again.", null)
      pending = null
    }
  }
}
