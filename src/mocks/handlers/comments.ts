import type { JsonObject, MockRequestContext } from './context'
import type { MockState } from '../state'
import {
  apiError,
  empty,
  findItem,
  json,
  list,
  setCommentStatus,
  setting,
} from './context'
import { toMeComment, updateMockState, writeMockState } from '../state'

function commentBatch(state: MockState, payload: JsonObject) {
  const ids = Array.isArray(payload.ids) ? payload.ids.map(String) : []
  const action = String(payload.action || '')
  const statusByAction: Record<string, string> = {
    pending: 'pending',
    publish: 'published',
    spam: 'spam',
    soft_delete: 'deleted',
    restore: 'pending',
  }
  let changed = 0
  for (const id of ids) {
    const item = findItem(state.comments, id)
    if (!item) continue
    if (action === 'hard_delete') {
      state.comments = state.comments.filter((comment) => comment.id !== id)
      changed++
    } else if (action === 'pin' || action === 'unpin') {
      item.is_pinned = action === 'pin'
      changed++
    } else if (statusByAction[action]) {
      setCommentStatus(state, id, statusByAction[action])
      changed++
    }
  }
  return {
    action,
    requested_count: ids.length,
    changed_count: changed,
    unchanged_count: ids.length - changed,
  }
}

export function handleComments({
  method,
  path,
  url,
  payload,
  state,
}: MockRequestContext): Response | undefined {
  if (method === 'GET' && path === '/admin/comments') {
    const result = list(state.comments, url)
    return json({ comments: result.rows, total: result.total })
  }
  if (method === 'GET' && path === '/admin/comments/trend') {
    const days = Number(url.searchParams.get('days')) === 30 ? 30 : 7
    const points = Array.from({ length: days }, (_, index) => ({
      date: new Date(Date.now() - (days - index - 1) * 86400_000)
        .toISOString()
        .slice(0, 10),
      count: (index % 3) + 1,
    }))
    return json({
      days,
      timezone: url.searchParams.get('timezone') || 'UTC',
      points,
    })
  }
  if (method === 'POST' && path === '/admin/comments/batch') {
    const result = updateMockState((current) => commentBatch(current, payload))
    return json(result)
  }
  const adminCommentPath = path.match(
    /^\/admin\/comments\/([^/]+)(?:\/(pin|publish|pending|spam|restore))?$/,
  )
  if (adminCommentPath) {
    const [, id, action] = adminCommentPath
    const comment = findItem(state.comments, id)
    if (!comment)
      return apiError(404, 'comment_not_found', 'Comment was not found.')
    if (method === 'GET' && !action) return json(comment)
    if (method === 'PATCH' && !action) {
      comment.body = String(payload.body ?? comment.body)
      writeMockState(state)
      return json(comment)
    }
    if (
      (action === 'pin' && method === 'PUT') ||
      (action === 'pin' && method === 'DELETE')
    ) {
      comment.is_pinned = method === 'PUT'
      writeMockState(state)
      return json(comment)
    }
    const statusActions: Record<string, string> = {
      publish: 'published',
      pending: 'pending',
      spam: 'spam',
      restore: 'pending',
    }
    if (action && method === 'POST' && statusActions[action]) {
      setCommentStatus(state, id, statusActions[action])!
      writeMockState(state)
      return empty()
    }
    if (!action && method === 'DELETE') {
      if (url.searchParams.get('hard') === 'true')
        state.comments = state.comments.filter((item) => item.id !== id)
      else setCommentStatus(state, id, 'deleted')
      writeMockState(state)
      return empty()
    }
  }

  if (method === 'GET' && path === '/me/comments/sites')
    return json({ sites: state.sites.map(({ id, name }) => ({ id, name })) })
  if (method === 'GET' && path === '/me/comments') {
    const ownerComments = state.comments.filter(
      (item) => item.user_id === state.me.id && item.status !== 'deleted',
    )
    const result = list(ownerComments.map(toMeComment), url)
    return json({
      comments: result.rows,
      total: result.total,
      user_delete_mode: setting(state, 'user_delete_mode', 'soft'),
    })
  }
  const ownComment = path.match(/^\/me\/comments\/([^/]+)$/)
  if (ownComment && method === 'GET') {
    const item = findItem(state.comments, ownComment[1])
    if (!item || item.user_id !== state.me.id || item.status === 'deleted')
      return apiError(404, 'comment_not_found', 'Comment was not found.')
    return json({
      ...toMeComment(item),
      user_delete_mode: setting(state, 'user_delete_mode', 'soft'),
    })
  }
  const replies = path.match(/^\/comments\/([^/]+)\/replies$/)
  if (replies && method === 'POST') {
    const parent = findItem(state.comments, replies[1])
    if (!parent)
      return apiError(404, 'comment_not_found', 'Comment was not found.')
    if (parent.status !== 'published')
      return apiError(
        409,
        'comment_not_replyable',
        'Only published comments can be replied to.',
      )
    const reply = {
      ...parent,
      id: String(state.nextId++),
      root_id: parent.root_id || parent.id,
      parent_id: parent.id,
      user_id: state.me.id,
      author_email: state.me.email,
      author_nickname: state.me.nickname,
      avatar_url: state.me.avatar_url,
      body: String(payload.body || ''),
      depth: parent.depth + 1,
      reply_to_user_id: parent.user_id,
      reply_to_nickname: parent.author_nickname,
      status: 'published',
      created_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    }
    state.comments.push(reply)
    writeMockState(state)
    return json(toMeComment(reply))
  }
  const ownDelete = path.match(/^\/comments\/([^/]+)$/)
  if (ownDelete && method === 'DELETE') {
    const item = findItem(state.comments, ownDelete[1])
    if (!item || item.user_id !== state.me.id)
      return apiError(404, 'comment_not_found', 'Comment was not found.')
    const hard = setting(state, 'user_delete_mode', 'soft') === 'hard'
    if (hard)
      state.comments = state.comments.filter(
        (comment) => comment.id !== item.id,
      )
    else setCommentStatus(state, item.id, 'deleted')
    writeMockState(state)
    return json({ deleted_root_id: item.root_id || item.id, hard })
  }

  return undefined
}
