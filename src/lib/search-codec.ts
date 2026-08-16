// search-codec 提供项目自有的 URL query 编解码器，交由 TanStack Router 的
// parseSearch / stringifySearch 使用。
//
// 默认的 parseSearchWith(JSON.parse) 内部先用 qss.decode 做基本类型转换：
// 十进制字符串 "1" 会被转成 number、true/false 转成 boolean，随后才执行
// JSON 解析回调。这会让 site_id=1 等 HTTP 契约字符串在进入 validateSearch 前
// 就丢失字符串语义，进而被路由严格校验丢弃并重写掉 URL 参数。
//
// 本项目所有路由都把 query 值当作标量字符串（或有序字符串数组），因此这里
// 直接用 URLSearchParams 读取原始 query，不做任何 JSON/number/boolean 转换。

function rawSearchString(searchStr: string): string {
  return searchStr.startsWith('?') ? searchStr.slice(1) : searchStr
}

/**
 * parseSearch 把原始 query 字符串解析为「字符串优先」的记录：
 * - 首次出现 -> 字符串；重复出现 -> 有序字符串数组；空值 -> 空字符串。
 * - 不做 JSON、number、boolean、null 强制转换。
 * - 用标准 URL 编码规则做百分号解码。
 */
export function parseSearch(searchStr: string): Record<string, unknown> {
  const params = new URLSearchParams(rawSearchString(searchStr))
  const result: Record<string, unknown> = {}
  for (const [key, value] of params.entries()) {
    const previous = result[key]
    if (previous === undefined) {
      result[key] = value
    } else if (Array.isArray(previous)) {
      previous.push(value)
    } else {
      result[key] = [previous, value]
    }
  }
  return result
}

function isPlainObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * stringifySearch 把 Router search 状态序列化为 URL query：
 * - 跳过 undefined；标量按文本表示；数组按顺序展开为重复键。
 * - 嵌套对象不在项目契约内，必须明确抛错，绝不能静默变成 "[object Object]"。
 * - 无条目返回空串，否则返回以 "?" 前缀的编码 query。
 */
export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        // 数组元素也必须是标量；嵌套对象或数组都不允许静默变成 "1,2"/"[object Object]"。
        if (typeof item === 'object' && item !== null) {
          throw new TypeError(`search-codec: 数组元素不能是嵌套对象 (${key})`)
        }
        params.append(key, String(item))
      }
      continue
    }
    if (isPlainObject(value)) {
      throw new TypeError(`search-codec: 不支持嵌套对象序列化 (${key})`)
    }
    params.append(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}
