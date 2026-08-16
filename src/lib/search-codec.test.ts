import { describe, expect, it } from 'vitest'
import { parseSearch, stringifySearch } from './search-codec'

describe('parseSearch', () => {
  it('preserves scalar values as raw strings without number/boolean coercion', () => {
    expect(parseSearch('site_id=1&authorize=true&flag=null&n=false')).toEqual({
      site_id: '1',
      authorize: 'true',
      flag: 'null',
      n: 'false',
    })
  })

  it('keeps decimal int64 text lossless', () => {
    expect(parseSearch('site_id=9223372036854775807')).toEqual({
      site_id: '9223372036854775807',
    })
  })

  it('collects repeated keys into an ordered string array', () => {
    expect(parseSearch('tag=1&tag=2&tag=3')).toEqual({ tag: ['1', '2', '3'] })
  })

  it('treats empty values as empty strings', () => {
    expect(parseSearch('authorize=&flag&empty=')).toEqual({
      authorize: '',
      flag: '',
      empty: '',
    })
  })

  it('strips a leading question mark', () => {
    expect(parseSearch('?site_id=1')).toEqual({ site_id: '1' })
    expect(parseSearch('')).toEqual({})
  })

  it('percent-decodes values with standard URL encoding', () => {
    expect(
      parseSearch('redirect=%2Fauthorize%3Fsite_id%3D1%26next%3D2'),
    ).toEqual({ redirect: '/authorize?site_id=1&next=2' })
    expect(parseSearch('q=a+b')).toEqual({ q: 'a b' })
  })
})

describe('stringifySearch', () => {
  it('serializes scalars through their textual representation', () => {
    expect(stringifySearch({ site_id: '1', authorize: 'true' })).toBe(
      '?site_id=1&authorize=true',
    )
    expect(stringifySearch({ page: 2, active: true })).toBe(
      '?page=2&active=true',
    )
  })

  it('emits repeated keys in order for arrays', () => {
    expect(stringifySearch({ tag: ['1', '2'] })).toBe('?tag=1&tag=2')
  })

  it('omits undefined entries', () => {
    expect(stringifySearch({ a: '1', b: undefined, c: '3' })).toBe('?a=1&c=3')
  })

  it('returns an empty string for no entries', () => {
    expect(stringifySearch({})).toBe('')
    expect(stringifySearch({ a: undefined })).toBe('')
  })

  it('percent-encodes values that need encoding', () => {
    expect(stringifySearch({ redirect: '/authorize?site_id=1&next=2' })).toBe(
      '?redirect=%2Fauthorize%3Fsite_id%3D1%26next%3D2',
    )
  })

  it('throws on nested objects instead of serializing as [object Object]', () => {
    expect(() => stringifySearch({ nested: { a: '1' } })).toThrowError(
      /不支持嵌套对象/,
    )
    expect(() => stringifySearch({ tag: [{ a: '1' }] })).toThrowError(
      /不能是嵌套对象/,
    )
    expect(() => stringifySearch({ tag: [['1', '2']] })).toThrowError(
      /不能是嵌套对象/,
    )
  })

  it('round-trips scalar and array values through parse and stringify', () => {
    const input: Record<string, unknown> = {
      site_id: '9223372036854775807',
      authorize: 'true',
      tag: ['1', '2'],
      empty: '',
      skipped: undefined,
    }
    const encoded = stringifySearch(input)
    expect(encoded).toBe(
      '?site_id=9223372036854775807&authorize=true&tag=1&tag=2&empty=',
    )
    expect(parseSearch(encoded)).toEqual({
      site_id: '9223372036854775807',
      authorize: 'true',
      tag: ['1', '2'],
      empty: '',
    })
  })
})
