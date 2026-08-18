#!/usr/bin/env node
// 检查 web/src/lib/api 下的直接 api.<method>(path) 调用是否都存在于
// docs/swagger/swagger.json 中。用 TypeScript 编译器 API 解析 AST，
// 拒绝无法静态归一化的动态 URL，防止契约漂移逃逸覆盖。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiDir = path.join(root, 'src', 'lib', 'api')
const swaggerPath = path.join(root, '..', 'docs', 'swagger', 'swagger.json')

const apiBase = '/api/v1'

// collectOperations 从 swagger JSON 提取小写 method -> 归一化路径集合。
// 路径参数统一归一化为 {} 占位符，忽略前后端参数名差异。
export function collectOperations(swagger) {
  const operations = new Map()
  for (const [swaggerPathKey, methods] of Object.entries(swagger.paths || {})) {
    for (const [method, _operation] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
      const normalized = swaggerPathKey.replace(/\/\{[^}]+\}/g, '/{}')
      if (!operations.has(method)) operations.set(method, new Set())
      operations.get(method).add(normalized)
    }
  }
  return operations
}

// isIdentifierLike 判断表达式是否可作为路径参数名（标识符或访问链）。
export function isIdentifierLike(expr) {
  if (ts.isIdentifier(expr)) return true
  if (
    ts.isPropertyAccessExpression(expr) &&
    (ts.isIdentifier(expr.name) || isIdentifierLike(expr.expression))
  ) {
    return true
  }
  return false
}

// extractStaticPath 提取 api.<method>(...) 的静态路径。
// 模板字符串中的 ${expr} 视为路径参数；表达式包含非标识符运算时返回 null。
export function extractStaticPath(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) {
    return node.text
  }
  if (ts.isTemplateExpression(node)) {
    let out = ''
    let head = node.head
    for (let i = 0; ; i++) {
      out += head.text
      const span = node.templateSpans[i]
      if (!span) break
      if (!isIdentifierLike(span.expression)) return null
      out += '${' + span.expression.getText() + '}'
      head = span.literal
    }
    return out
  }
  return null
}

// normalizePath 把 api 调用路径统一为 swagger 形式。
// 绝对 URL 或非 /api/v1 前缀视为错误；无前缀的相对路径补全 /api/v1。
// 模板表达式段归一化为 {} 占位符。
export function normalizePath(raw) {
  const trimmed = raw.trim()
  if (/^[a-z]+:\/\//i.test(trimmed)) return null
  let prefixed = trimmed
  if (trimmed.startsWith(apiBase)) {
    // 保持原样
  } else if (trimmed.startsWith('/')) {
    prefixed = apiBase + trimmed
  } else {
    prefixed = apiBase + '/' + trimmed
  }
  return prefixed.replace(/\$\{[^}]+\}/g, '{}')
}

// checkSource 检查单个 TS 文件，返回 { issues, checked }。
export function checkSource(file, sourceText, operations, fileName) {
  const source = ts.createSourceFile(
    fileName || file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const issues = []
  let checked = 0
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const method = node.expression.name.text
      if (node.expression.expression.getText() === 'api') {
        const raw = node.arguments[0]
        const staticPath = raw ? extractStaticPath(raw) : null
        if (staticPath === null) {
          issues.push(
            `${node.getStart(source)}: dynamic URL cannot be statically checked: ${raw?.getText() || '<missing>'} (use a template literal with a plain identifier placeholder)`,
          )
        } else {
          const normalized = normalizePath(staticPath)
          if (normalized === null) {
            issues.push(
              `${node.getStart(source)}: non-/api/v1 absolute URL is not checkable: ${staticPath}`,
            )
          } else if (!operations.get(method)?.has(normalized)) {
            issues.push(
              `${node.getStart(source)}: missing swagger operation: ${method.toUpperCase()} ${normalized}`,
            )
          }
          checked++
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { issues, checked }
}

// collectIssues 扫描 lib/api 下所有非测试 TS 文件。
export function collectIssues(apiDir, operations, relativeRoot) {
  const issues = []
  let checked = 0
  for (const file of listSourceFiles(apiDir)) {
    const text = fs.readFileSync(file, 'utf8')
    const result = checkSource(file, text, operations, file)
    issues.push(
      ...result.issues.map(
        (issue) =>
          `${path.relative(relativeRoot, file).replaceAll('\\', '/')}:${issue}`,
      ),
    )
    checked += result.checked
  }
  return { issues, checked }
}

// listSourceFiles 收集目录下所有非测试 .ts 文件。
export function listSourceFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (
      entry.isFile() &&
      /\.ts$/.test(entry.name) &&
      !/\.test\.ts$/.test(entry.name) &&
      !/\.d\.ts$/.test(entry.name)
    ) {
      out.push(full)
    }
  }
  return out
}

// main 是 CLI 入口，仅直接执行时运行。
export function main() {
  const swagger = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'))
  const operations = collectOperations(swagger)
  const { issues, checked } = collectIssues(apiDir, operations, root)
  if (issues.length > 0) {
    console.error(
      `API contract check failed (${issues.length} issue(s), ${checked} operations checked):`,
    )
    for (const issue of issues) {
      console.error(`  - ${issue}`)
    }
    return 1
  }
  console.log(
    `API contract check OK: ${checked} frontend operations match the Swagger document.`,
  )
  return 0
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  process.exit(main())
}
