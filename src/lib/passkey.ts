function toBase64Url(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

// decodeBase64Url 严格解码 base64url 字符串为 ArrayBuffer。
// 空值、非法字符、非法长度或 padding 都抛出带字段名的可理解错误。
function decodeBase64Url(value: string, field: string): ArrayBuffer {
  if (value.length === 0) {
    throw new Error(`passkey 选项 ${field} 不是合法的 base64url`)
  }
  const core = value.replace(/=+$/, '')
  if (core.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(core)) {
    throw new Error(`passkey 选项 ${field} 不是合法的 base64url`)
  }
  const padded = core.replaceAll('-', '+').replaceAll('_', '/')
  try {
    const binary = atob(padded + '='.repeat((4 - (core.length % 4)) % 4))
    return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer
  } catch {
    throw new Error(`passkey 选项 ${field} 不是合法的 base64url`)
  }
}

// requireBase64Url 校验必填 base64url 字段存在并完成转换。
function requireBase64Url(value: unknown, field: string): ArrayBuffer {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`passkey 选项缺少 ${field}`)
  }
  return decodeBase64Url(value, field)
}

// parseEnvelope 校验顶层 WebAuthn 包装对象 { publicKey, mediation? } 并返回其深拷贝。
// 返回的 envelope 是完整顶层 options，包含 publicKey 与可选的顶层字段（如 mediation）。
function parseEnvelope(input: unknown): {
  envelope: Record<string, unknown>
  publicKey: Record<string, unknown>
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('passkey 选项格式无效')
  }
  const envelope = structuredClone(input) as Record<string, unknown>
  const publicKey = envelope.publicKey
  if (!publicKey || typeof publicKey !== 'object' || Array.isArray(publicKey)) {
    throw new Error('passkey 选项缺少 publicKey')
  }
  return { envelope, publicKey: publicKey as Record<string, unknown> }
}

// decodeCredentialDescriptors 把 allowCredentials/excludeCredentials 中每个
// 凭据 id 从 base64url 转换为 ArrayBuffer；空数组合法保留。
function decodeCredentialDescriptors(value: unknown, field: string): unknown {
  if (!Array.isArray(value)) return value
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`passkey 选项 ${field} 包含无效的凭据条目`)
    }
    const descriptor = structuredClone(item) as Record<string, unknown>
    if (typeof descriptor.id !== 'string' || descriptor.id.length === 0) {
      throw new Error(`passkey 选项 ${field} 缺少凭据 id`)
    }
    descriptor.id = decodeBase64Url(descriptor.id, `${field}.id`)
    return descriptor
  })
}

// prepareCredentialCreationOptions 消费后端返回的顶层注册选项
// （go-webauthn 序列化的 { publicKey, mediation? }），校验必填字节字段并转换，
// 返回可直接传给 navigator.credentials.create 的完整对象。
export function prepareCredentialCreationOptions(
  input: unknown,
): CredentialCreationOptions {
  const { envelope, publicKey } = parseEnvelope(input)
  publicKey.challenge = requireBase64Url(publicKey.challenge, 'challenge')
  const user = publicKey.user
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    throw new Error('passkey 注册选项缺少 user')
  }
  const userRecord = user as Record<string, unknown>
  userRecord.id = requireBase64Url(userRecord.id, 'user.id')
  publicKey.excludeCredentials = decodeCredentialDescriptors(
    publicKey.excludeCredentials,
    'excludeCredentials',
  )
  return envelope
}

// prepareCredentialRequestOptions 消费后端返回的顶层断言选项
// （go-webauthn 序列化的 { publicKey, mediation? }），校验必填字节字段并转换，
// 返回可直接传给 navigator.credentials.get 的完整对象。
export function prepareCredentialRequestOptions(
  input: unknown,
): CredentialRequestOptions {
  const { envelope, publicKey } = parseEnvelope(input)
  publicKey.challenge = requireBase64Url(publicKey.challenge, 'challenge')
  publicKey.allowCredentials = decodeCredentialDescriptors(
    publicKey.allowCredentials,
    'allowCredentials',
  )
  return envelope
}

function serializeClientData(data: ArrayBuffer) {
  return toBase64Url(data)
}

function serializeAuthenticatorData(data: ArrayBuffer) {
  return toBase64Url(data)
}

export function serializeCredential(credential: PublicKeyCredential | null) {
  if (!credential || !('response' in credential))
    throw new Error('浏览器没有返回有效的 passkey 凭证')
  const response = credential.response as
    AuthenticatorAssertionResponse | AuthenticatorAttestationResponse
  const payload: Record<string, unknown> = {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {},
  }
  if ('clientDataJSON' in response)
    payload.response = {
      clientDataJSON: serializeClientData(response.clientDataJSON),
    }
  if ('authenticatorData' in response) {
    const assertion = response
    payload.response = {
      ...(payload.response as object),
      authenticatorData: serializeAuthenticatorData(
        assertion.authenticatorData,
      ),
      signature: toBase64Url(assertion.signature),
      userHandle: assertion.userHandle
        ? toBase64Url(assertion.userHandle)
        : null,
    }
  } else {
    const attestation = response
    payload.response = {
      ...(payload.response as object),
      attestationObject: toBase64Url(attestation.attestationObject),
    }
  }
  return payload
}

export function isPasskeySupported() {
  return (
    typeof window !== 'undefined' &&
    'PublicKeyCredential' in window &&
    !!navigator.credentials
  )
}
