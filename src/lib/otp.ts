/**
 * First-party email-code login pending context.
 *
 * 邮箱验证码登录的「发送 → 校验」两阶段需要把待登录上下文带到独立 OTP 路由。
 * 上下文只写入 popup/标签页自己的 sessionStorage，绝不进入 URL：
 * 邮箱、安全回跳与授权 marker 只存在于该 versioned 记录中，验证码本身与
 * CAPTCHA token 从不落盘。记录短生命周期（5 分钟）且每次读取都做防御性校验，
 * 缺失/损坏/过期即删除并返回登录页。
 */

export const otpRecordVersion = 1
/** 登录验证码有效期为 5 分钟，与后端一致；到期后记录自清。 */
export const otpRecordTTLMs = 5 * 60 * 1000
export const otpRecordKey = 'furtalk:otp:pending'

export interface PendingOtpLogin {
  version: typeof otpRecordVersion
  email: string
  /** 登录完成后的安全本地回跳；可选，缺失时按角色进入默认区域。 */
  redirect?: string
  /** 是否处于 Widget 授权 popup 流程（authorize=1 marker）。 */
  authorize: boolean
  created_at: string
  expires_at: string
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** 返回当前标签页的 sessionStorage；不可用时返回 null（流程无持久化继续）。 */
export function safeOtpSessionStorage(): StorageLike | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

/** 以当前时刻（或注入的 now）为基准创建带 5 分钟过期的记录。 */
export function createOtpRecord(input: {
  email: string
  redirect?: string
  authorize: boolean
  now?: Date
}): PendingOtpLogin {
  const now = input.now ?? new Date()
  return {
    version: otpRecordVersion,
    email: input.email,
    redirect: input.redirect,
    authorize: input.authorize,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + otpRecordTTLMs).toISOString(),
  }
}

/** 判断记录是否已过期（到达或超过 expires_at）。 */
export function isOtpExpired(record: PendingOtpLogin, now?: Date): boolean {
  const at = now ?? new Date()
  return at.getTime() >= Date.parse(record.expires_at)
}

/** 写入记录，best-effort，任何存储异常都不抛出。 */
export function writeOtpRecord(
  storage: StorageLike | null,
  record: PendingOtpLogin,
): void {
  if (!storage) return
  try {
    storage.setItem(otpRecordKey, JSON.stringify(record))
  } catch {
    // sessionStorage 不可用：流程在无持久化的情况下继续，页面刷新后回到登录页。
  }
}

/** 防御性解析 JSON；结构/版本不匹配一律返回 null。 */
function parseOtpRecord(raw: string | null): PendingOtpLogin | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingOtpLogin>
    if (
      parsed.version !== otpRecordVersion ||
      typeof parsed.email !== 'string' ||
      parsed.email === '' ||
      typeof parsed.authorize !== 'boolean' ||
      typeof parsed.created_at !== 'string' ||
      typeof parsed.expires_at !== 'string'
    ) {
      return null
    }
    return {
      version: otpRecordVersion,
      email: parsed.email,
      redirect:
        typeof parsed.redirect === 'string' ? parsed.redirect : undefined,
      authorize: parsed.authorize,
      created_at: parsed.created_at,
      expires_at: parsed.expires_at,
    }
  } catch {
    return null
  }
}

/**
 * 读取并校验记录：缺失/损坏/过期都会先清除旧记录再返回 null。
 * 过期清理保证 5 分钟窗口后不会留下可被误用的残留上下文。
 */
export function readOtpRecord(
  storage: StorageLike | null,
  now?: Date,
): PendingOtpLogin | null {
  if (!storage) return null
  let raw: string | null = null
  try {
    raw = storage.getItem(otpRecordKey)
  } catch {
    return null
  }
  const record = parseOtpRecord(raw)
  if (!record) {
    clearOtpRecord(storage)
    return null
  }
  if (isOtpExpired(record, now)) {
    clearOtpRecord(storage)
    return null
  }
  return record
}

/** 删除记录，best-effort。 */
export function clearOtpRecord(storage: StorageLike | null): void {
  if (!storage) return
  try {
    storage.removeItem(otpRecordKey)
  } catch {
    // 记录短生命周期，到期自动失效，删除失败可忽略。
  }
}

/** 重新发送成功后刷新过期时间（保留创建时间，仅替换 expires_at）。 */
export function refreshOtpExpiry(
  record: PendingOtpLogin,
  now?: Date,
): PendingOtpLogin {
  const base = now ?? new Date()
  return {
    ...record,
    expires_at: new Date(base.getTime() + otpRecordTTLMs).toISOString(),
  }
}

/**
 * 生成掩码展示邮箱：保留本地部分首字符，其余以 *** 代替，域名完整保留。
 * 例如 visitor@example.com -> v***@example.com；v@example.com -> v***@example.com。
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) return '***'
  return `${email[0]}***${email.slice(atIndex)}`
}
