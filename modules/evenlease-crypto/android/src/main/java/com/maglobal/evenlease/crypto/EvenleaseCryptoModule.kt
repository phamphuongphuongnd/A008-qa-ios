package com.maglobal.evenlease.crypto

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * PBKDF2-HMAC-SHA256 (RFC 8018) for the backup password (B-101). The loop is written out over HMAC on the password's
 * BYTES: PBEKeySpec takes a char[] whose encoding into bytes has differed between Android versions, and the key must
 * match what @noble/hashes derives in JS (old files, other phones). AsyncFunction runs off the JS thread.
 */
class EvenleaseCryptoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EvenleaseCrypto")

    AsyncFunction("pbkdf2Sha256") { passwordHex: String, saltHex: String, iterations: Int, keyLength: Int ->
      require(iterations >= 1) { "iterations must be >= 1" }
      require(keyLength in 1..1024) { "bad key length" }
      toHex(pbkdf2(fromHex(passwordHex), fromHex(saltHex), iterations, keyLength))
    }
  }

  companion object {
    private const val H_LEN = 32

    fun pbkdf2(password: ByteArray, salt: ByteArray, iterations: Int, keyLength: Int): ByteArray {
      val mac = Mac.getInstance("HmacSHA256")
      // SecretKeySpec refuses an empty key; HMAC pads a short key with zeros, so one zero byte is the same key.
      mac.init(SecretKeySpec(if (password.isEmpty()) ByteArray(1) else password, "HmacSHA256"))
      val blocks = (keyLength + H_LEN - 1) / H_LEN
      val out = ByteArray(blocks * H_LEN)
      for (i in 1..blocks) {
        mac.update(salt)
        mac.update(byteArrayOf((i ushr 24).toByte(), (i ushr 16).toByte(), (i ushr 8).toByte(), i.toByte()))
        var u = mac.doFinal()
        val t = u.copyOf()
        for (j in 1 until iterations) {
          u = mac.doFinal(u)
          for (k in 0 until H_LEN) t[k] = (t[k].toInt() xor u[k].toInt()).toByte()
        }
        System.arraycopy(t, 0, out, (i - 1) * H_LEN, H_LEN)
      }
      return out.copyOf(keyLength)
    }

    private fun fromHex(s: String): ByteArray {
      require(s.length % 2 == 0) { "odd hex length" }
      return ByteArray(s.length / 2) { i -> s.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
    }

    private fun toHex(b: ByteArray): String {
      val sb = StringBuilder(b.size * 2)
      for (x in b) sb.append(String.format("%02x", x.toInt() and 0xff))
      return sb.toString()
    }
  }
}
