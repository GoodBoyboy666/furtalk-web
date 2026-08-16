import { describe, expect, it } from 'vitest'
import {
  prepareCredentialCreationOptions,
  prepareCredentialRequestOptions,
  serializeCredential,
} from './passkey'

// creationEnvelope 是后端 go-webauthn 输出的真实顶层注册选项形状：
// CredentialCreation 序列化为 { publicKey, mediation? }，字节字段是 base64url 字符串。
const creationEnvelope = {
  publicKey: {
    rp: { id: 'furtalk.example.com', name: 'Furtalk' },
    user: {
      id: 'MTAw',
      name: 'alice',
      displayName: 'Alice',
    },
    challenge: 'Y2hhbGxlbmdlLWJ5dGVz',
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: 60000,
    excludeCredentials: [
      { type: 'public-key', id: 'Y3JlZDE' },
      { type: 'public-key', id: 'Y3JlZDI' },
    ],
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    attestation: 'none',
  },
  mediation: 'optional',
}

// requestEnvelope 是后端 go-webauthn 输出的真实顶层断言选项形状。
const requestEnvelope = {
  publicKey: {
    challenge: 'Y2hhbGxlbmdlLWJ5dGVz',
    rpId: 'furtalk.example.com',
    allowCredentials: [
      { type: 'public-key', id: 'Y3JlZDE', transports: ['internal'] },
    ],
    userVerification: 'preferred',
    timeout: 60000,
  },
  mediation: 'optional',
}

function decodeBuffer(value: BufferSource | undefined) {
  if (value == null) return ''
  return new TextDecoder().decode(value)
}

describe('prepareCredentialCreationOptions', () => {
  it('decodes byte fields and returns the full top-level options object', () => {
    const options = prepareCredentialCreationOptions(creationEnvelope)
    // 顶层对象是 { publicKey, mediation }，不再出现 publicKey.publicKey 双重嵌套。
    expect(options.publicKey).not.toHaveProperty('publicKey')
    expect(options).toHaveProperty('mediation', 'optional')
    expect(options.publicKey?.rp).toEqual({
      id: 'furtalk.example.com',
      name: 'Furtalk',
    })
    expect(decodeBuffer(options.publicKey?.challenge)).toBe('challenge-bytes')
    expect(decodeBuffer(options.publicKey?.user.id)).toBe('100')
    expect(decodeBuffer(options.publicKey?.excludeCredentials?.[0].id)).toBe(
      'cred1',
    )
    expect(decodeBuffer(options.publicKey?.excludeCredentials?.[1].id)).toBe(
      'cred2',
    )
    expect(options.publicKey?.pubKeyCredParams).toEqual([
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ])
    expect(options.publicKey?.authenticatorSelection).toEqual({
      residentKey: 'preferred',
      userVerification: 'preferred',
    })
  })

  it('preserves an empty excludeCredentials array', () => {
    const options = prepareCredentialCreationOptions({
      ...creationEnvelope,
      publicKey: { ...creationEnvelope.publicKey, excludeCredentials: [] },
    })
    expect(options.publicKey?.excludeCredentials).toEqual([])
  })

  it('omits mediation when the backend did not send it', () => {
    const options = prepareCredentialCreationOptions({
      publicKey: creationEnvelope.publicKey,
    })
    expect(options).not.toHaveProperty('mediation')
    expect(options.publicKey?.challenge).toBeInstanceOf(ArrayBuffer)
  })

  it('rejects a missing publicKey', () => {
    expect(() => prepareCredentialCreationOptions({})).toThrow(
      'passkey 选项缺少 publicKey',
    )
  })

  it('rejects a missing challenge', () => {
    expect(() =>
      prepareCredentialCreationOptions({
        publicKey: { user: { id: 'MTAw' } },
      }),
    ).toThrow('passkey 选项缺少 challenge')
  })

  it('rejects a missing user', () => {
    expect(() =>
      prepareCredentialCreationOptions({
        publicKey: { challenge: 'Y2hhbGxlbmdlLWJ5dGVz' },
      }),
    ).toThrow('passkey 注册选项缺少 user')
  })

  it('rejects a missing user.id', () => {
    expect(() =>
      prepareCredentialCreationOptions({
        publicKey: {
          challenge: 'Y2hhbGxlbmdlLWJ5dGVz',
          user: { name: 'alice', displayName: 'Alice' },
        },
      }),
    ).toThrow('passkey 选项缺少 user.id')
  })

  it('rejects an invalid base64url challenge', () => {
    expect(() =>
      prepareCredentialCreationOptions({
        publicKey: {
          challenge: 'not base64!!!',
          user: { id: 'MTAw' },
        },
      }),
    ).toThrow('passkey 选项 challenge 不是合法的 base64url')
  })

  it('rejects a credential descriptor without an id', () => {
    expect(() =>
      prepareCredentialCreationOptions({
        ...creationEnvelope,
        publicKey: {
          ...creationEnvelope.publicKey,
          excludeCredentials: [{ type: 'public-key' }],
        },
      }),
    ).toThrow('passkey 选项 excludeCredentials 缺少凭据 id')
  })

  it('rejects an invalid base64url credential id', () => {
    expect(() =>
      prepareCredentialCreationOptions({
        ...creationEnvelope,
        publicKey: {
          ...creationEnvelope.publicKey,
          excludeCredentials: [{ type: 'public-key', id: '!!!' }],
        },
      }),
    ).toThrow('passkey 选项 excludeCredentials.id 不是合法的 base64url')
  })

  it('rejects non-object input', () => {
    expect(() => prepareCredentialCreationOptions(null)).toThrow(
      'passkey 选项格式无效',
    )
    expect(() => prepareCredentialCreationOptions('nope')).toThrow(
      'passkey 选项格式无效',
    )
  })
})

describe('prepareCredentialRequestOptions', () => {
  it('decodes challenge and credential ids and returns the full top-level options', () => {
    const options = prepareCredentialRequestOptions(requestEnvelope)
    expect(options.publicKey).not.toHaveProperty('publicKey')
    expect(options).toHaveProperty('mediation', 'optional')
    expect(options.publicKey?.rpId).toBe('furtalk.example.com')
    expect(decodeBuffer(options.publicKey?.challenge)).toBe('challenge-bytes')
    expect(decodeBuffer(options.publicKey?.allowCredentials?.[0].id)).toBe(
      'cred1',
    )
    expect(options.publicKey?.allowCredentials?.[0].transports).toEqual([
      'internal',
    ])
  })

  it('preserves an empty allowCredentials array', () => {
    const options = prepareCredentialRequestOptions({
      ...requestEnvelope,
      publicKey: { ...requestEnvelope.publicKey, allowCredentials: [] },
    })
    expect(options.publicKey?.allowCredentials).toEqual([])
  })

  it('rejects a missing publicKey', () => {
    expect(() =>
      prepareCredentialRequestOptions({ mediation: 'optional' }),
    ).toThrow('passkey 选项缺少 publicKey')
  })

  it('rejects a missing challenge', () => {
    expect(() => prepareCredentialRequestOptions({ publicKey: {} })).toThrow(
      'passkey 选项缺少 challenge',
    )
  })

  it('rejects an invalid base64url challenge length', () => {
    expect(() =>
      prepareCredentialRequestOptions({
        publicKey: { challenge: 'abcde' },
      }),
    ).toThrow('passkey 选项 challenge 不是合法的 base64url')
  })

  it('rejects a non-object credential entry', () => {
    expect(() =>
      prepareCredentialRequestOptions({
        ...requestEnvelope,
        publicKey: {
          ...requestEnvelope.publicKey,
          allowCredentials: ['not-an-object'],
        },
      }),
    ).toThrow('passkey 选项 allowCredentials 包含无效的凭据条目')
  })
})

describe('serializeCredential', () => {
  // assertion 是浏览器断言响应的形状：clientDataJSON/authenticatorData/signature/userHandle
  // 均为 ArrayBuffer，序列化后统一转为 base64url 字符串。
  it('serializes an assertion response to base64url', () => {
    const payload = serializeCredential({
      id: 'cred-id',
      rawId: new TextEncoder().encode('raw').buffer,
      type: 'public-key',
      response: {
        clientDataJSON: new TextEncoder().encode('{"challenge":"c"}').buffer,
        authenticatorData: new TextEncoder().encode('authdata').buffer,
        signature: new TextEncoder().encode('sig').buffer,
        userHandle: new TextEncoder().encode('user').buffer,
      },
    } as unknown as PublicKeyCredential)
    expect(payload).toEqual({
      id: 'cred-id',
      rawId: 'cmF3',
      type: 'public-key',
      response: {
        clientDataJSON: 'eyJjaGFsbGVuZ2UiOiJjIn0',
        authenticatorData: 'YXV0aGRhdGE',
        signature: 'c2ln',
        userHandle: 'dXNlcg',
      },
    })
  })

  it('serializes a null userHandle as null', () => {
    const payload = serializeCredential({
      id: 'cred-id',
      rawId: new Uint8Array([1]).buffer,
      type: 'public-key',
      response: {
        clientDataJSON: new Uint8Array([2]).buffer,
        authenticatorData: new Uint8Array([3]).buffer,
        signature: new Uint8Array([4]).buffer,
        userHandle: null,
      },
    } as unknown as PublicKeyCredential)
    expect(payload.response).toMatchObject({ userHandle: null })
  })

  it('serializes an attestation response to base64url', () => {
    const payload = serializeCredential({
      id: 'cred-id',
      rawId: new TextEncoder().encode('raw').buffer,
      type: 'public-key',
      response: {
        clientDataJSON: new TextEncoder().encode('{"attestation":"obj"}')
          .buffer,
        attestationObject: new TextEncoder().encode('obj-bytes').buffer,
      },
    } as unknown as PublicKeyCredential)
    expect(payload).toEqual({
      id: 'cred-id',
      rawId: 'cmF3',
      type: 'public-key',
      response: {
        clientDataJSON: 'eyJhdHRlc3RhdGlvbiI6Im9iaiJ9',
        attestationObject: 'b2JqLWJ5dGVz',
      },
    })
  })

  it('rejects null or a credential without a response', () => {
    expect(() => serializeCredential(null)).toThrow(
      '浏览器没有返回有效的 passkey 凭证',
    )
    expect(() =>
      serializeCredential({ id: 'cred-id' } as unknown as PublicKeyCredential),
    ).toThrow('浏览器没有返回有效的 passkey 凭证')
  })
})
