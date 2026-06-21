/**
 * Two-Factor Authentication (2FA) with TOTP
 */

import { TOTP, generateSecret as otpGenerateSecret, generateURI, verify as otpVerify } from 'otplib'
import QRCode from 'qrcode'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { logger } from '../logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Generate TOTP secret for user
 */
export function generateTOTPSecret(): string {
  return otpGenerateSecret()
}

/**
 * Generate OTP Auth URL for QR code
 */
export function generateOTPAuthUrl(email: string, secret: string): string {
  return generateURI({ label: email, issuer: 'AdPilot AI', secret, algorithm: 'sha1', digits: 6, period: 30 })
}

/**
 * Generate QR code data URL
 */
export async function generateQRCode(otpAuthUrl: string): Promise<string> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl)
    return qrCodeDataUrl
  } catch (error) {
    logger.error('QR code generation failed', error)
    throw new Error('Failed to generate QR code')
  }
}

/**
 * Verify TOTP token
 */
export async function verifyTOTPToken(token: string, secret: string): Promise<boolean> {
  try {
    const result = await otpVerify({ token, secret })
    return result.valid
  } catch (error) {
    logger.error('TOTP verification error', error)
    return false
  }
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}`
    codes.push(formatted)
  }
  return codes
}

/**
 * Hash backup code for storage
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

/**
 * Enable 2FA for user
 */
export async function enable2FA(
  userId: string,
  secret: string,
  token: string
): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
  try {
    // Verify token before enabling
    if (!(await verifyTOTPToken(token, secret))) {
      return { success: false, error: 'Invalid verification code' }
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes()
    const hashedCodes = backupCodes.map(hashBackupCode)

    // Update user record
    const { error } = await supabase
      .from('users')
      .update({
        two_factor_enabled: true,
        two_factor_secret: secret,
        backup_codes: hashedCodes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      logger.error('2FA enable failed', error, { userId })
      return { success: false, error: 'Failed to enable 2FA' }
    }

    logger.info('2FA enabled for user', { userId })
    
    return {
      success: true,
      backupCodes, // Return plaintext codes to show user (only time they see them)
    }
  } catch (error) {
    logger.error('2FA enable error', error, { userId })
    return { success: false, error: 'An error occurred' }
  }
}

/**
 * Disable 2FA for user
 */
export async function disable2FA(
  userId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // In production, verify password before disabling
    // This requires password verification implementation

    // Update user record
    const { error } = await supabase
      .from('users')
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
        backup_codes: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      logger.error('2FA disable failed', error, { userId })
      return { success: false, error: 'Failed to disable 2FA' }
    }

    logger.info('2FA disabled for user', { userId })
    
    return { success: true }
  } catch (error) {
    logger.error('2FA disable error', error, { userId })
    return { success: false, error: 'An error occurred' }
  }
}

/**
 * Verify 2FA token during login
 */
export async function verify2FA(
  userId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user's 2FA secret
    const { data: user, error } = await supabase
      .from('users')
      .select('two_factor_secret, backup_codes')
      .eq('id', userId)
      .single()

    if (error || !user) {
      return { success: false, error: 'User not found' }
    }

    if (!user.two_factor_secret) {
      return { success: false, error: '2FA not enabled' }
    }

    // Check if it's a TOTP token
    if (await verifyTOTPToken(token, user.two_factor_secret)) {
      logger.info('2FA verified with TOTP', { userId })
      return { success: true }
    }

    // Check if it's a backup code
    const normalizedToken = token.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const hashedToken = hashBackupCode(normalizedToken)
    
    if (user.backup_codes && Array.isArray(user.backup_codes)) {
      const codeIndex = user.backup_codes.indexOf(hashedToken)
      
      if (codeIndex !== -1) {
        // Valid backup code - remove it so it can't be reused
        const newBackupCodes = [...user.backup_codes]
        newBackupCodes.splice(codeIndex, 1)
        
        await supabase
          .from('users')
          .update({ backup_codes: newBackupCodes })
          .eq('id', userId)

        logger.info('2FA verified with backup code', { userId, remainingCodes: newBackupCodes.length })
        return { success: true }
      }
    }

    // Neither TOTP nor backup code worked
    logger.warn('2FA verification failed', { userId })
    return { success: false, error: 'Invalid verification code' }
  } catch (error) {
    logger.error('2FA verification error', error, { userId })
    return { success: false, error: 'An error occurred' }
  }
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(
  userId: string
): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
  try {
    // Generate new backup codes
    const backupCodes = generateBackupCodes()
    const hashedCodes = backupCodes.map(hashBackupCode)

    // Update user record
    const { error } = await supabase
      .from('users')
      .update({
        backup_codes: hashedCodes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      logger.error('Backup code regeneration failed', error, { userId })
      return { success: false, error: 'Failed to regenerate backup codes' }
    }

    logger.info('Backup codes regenerated', { userId })
    
    return {
      success: true,
      backupCodes,
    }
  } catch (error) {
    logger.error('Backup code regeneration error', error, { userId })
    return { success: false, error: 'An error occurred' }
  }
}

/**
 * Check if user has 2FA enabled
 */
export async function is2FAEnabled(userId: string): Promise<boolean> {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('two_factor_enabled')
      .eq('id', userId)
      .single()

    return user?.two_factor_enabled === true
  } catch (error) {
    logger.error('2FA check error', error, { userId })
    return false
  }
}

export default {
  generateTOTPSecret,
  generateOTPAuthUrl,
  generateQRCode,
  verifyTOTPToken,
  generateBackupCodes,
  enable2FA,
  disable2FA,
  verify2FA,
  regenerateBackupCodes,
  is2FAEnabled,
}
