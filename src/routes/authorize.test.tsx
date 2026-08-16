// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthorizePage, authorizeLoginRedirect } from './authorize'
import { ApiError } from '@/lib/api/client'
import {
  pendingRecordKey,
  pendingRecordTTLMs,
  writePendingAuthorization,
} from '@/lib/authorize'
import type { PendingAuthorization } from '@/lib/authorize'

const apiMocks = vi.hoisted(() => {
  const search: Record<string, unknown> = {}
  return {
    navigate: vi.fn(),
    search,
    context: vi.fn(),
    issue: vi.fn(),
  }
})

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: null }),
  useNavigate: () => apiMocks.navigate,
  useSearch: () => apiMocks.search,
}))

vi.mock('@/lib/api/resources', () => ({
  authorizationApi: {
    context: apiMocks.context,
    issue: apiMocks.issue,
  },
}))

const requestId = 'AQEBAQEBAQEBAQEBAQEBAQ'
const siteId = '123'
const embeddingOrigin = 'https://embed.example'

const contextResult = {
  site_id: siteId,
  site_name: 'Example Blog',
  origin: embeddingOrigin,
}

const openerPostMessage = vi.hoisted(() => vi.fn())
const openerMock = { postMessage: openerPostMessage } as unknown as Window
const closeMock = vi.hoisted(() => vi.fn())

function renderAuthorize() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthorizePage />
    </QueryClientProvider>,
  )
}

function setSearch(patch: Record<string, unknown>) {
  apiMocks.search = { ...patch }
}

function pendingRecord(): PendingAuthorization {
  return {
    version: 2,
    site_id: siteId,
    request_id: requestId,
    embedding_origin: embeddingOrigin,
    email: 'visitor@example.com',
    expires_at: new Date(Date.now() + pendingRecordTTLMs).toISOString(),
  }
}

function dispatchInit() {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        type: 'furtalk:authorization-init',
        request_id: requestId,
        email: 'visitor@example.com',
      },
      origin: embeddingOrigin,
      source: openerMock,
    }),
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  sessionStorage.clear()
  setSearch({ site_id: siteId, request_id: requestId })
  apiMocks.context.mockResolvedValue(contextResult)
  apiMocks.issue.mockResolvedValue({
    code: 'auth-code',
    request_id: requestId,
    expires_at: '2026-08-11T00:00:40Z',
  })
  Object.defineProperty(window, 'opener', {
    configurable: true,
    value: openerMock,
  })
  Object.defineProperty(window, 'close', {
    configurable: true,
    value: closeMock,
  })
})

afterEach(() => {
  Object.defineProperty(window, 'opener', { configurable: true, value: null })
  Object.defineProperty(window, 'close', {
    configurable: true,
    value: () => undefined,
  })
})

describe('AuthorizePage parameter validation', () => {
  it('renders an invalid-request error for missing site_id', async () => {
    setSearch({ request_id: requestId })
    renderAuthorize()
    expect(await screen.findByText('授权请求参数无效')).toBeInTheDocument()
    expect(apiMocks.context).not.toHaveBeenCalled()
  })

  it('renders an invalid-request error for a malformed request_id', async () => {
    setSearch({ site_id: siteId, request_id: 'bad id!' })
    renderAuthorize()
    expect(await screen.findByText('授权请求参数无效')).toBeInTheDocument()
  })

  it('requires a usable window.opener', async () => {
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: null,
    })
    renderAuthorize()
    expect(
      await screen.findByText('此页面需要从评论组件打开'),
    ).toBeInTheDocument()
    expect(apiMocks.context).not.toHaveBeenCalled()
  })
})

describe('AuthorizePage handshake', () => {
  it('stores the pending record, acks ready, and queries the context', async () => {
    renderAuthorize()
    await screen.findByText('正在与评论组件握手…')

    dispatchInit()

    await waitFor(() => {
      expect(apiMocks.context).toHaveBeenCalledWith(siteId, embeddingOrigin)
    })
    await waitFor(() => {
      expect(openerPostMessage).toHaveBeenCalledWith(
        { type: 'furtalk:authorization-ready', request_id: requestId },
        embeddingOrigin,
      )
    })
    const stored = sessionStorage.getItem(pendingRecordKey(requestId))
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored as string)).toMatchObject({
      version: 2,
      site_id: siteId,
      request_id: requestId,
      embedding_origin: embeddingOrigin,
      email: 'visitor@example.com',
    })
    // 协议不再携带昵称/网址，pending 记录也不得包含它们。
    expect(JSON.parse(stored as string)).not.toHaveProperty('nickname')
    expect(JSON.parse(stored as string)).not.toHaveProperty('website_url')

    expect(await screen.findByText('站点：Example Blog')).toBeInTheDocument()
    expect(screen.getByText(embeddingOrigin)).toBeInTheDocument()
  })

  it('ignores init messages with a mismatched request id', async () => {
    renderAuthorize()
    await screen.findByText('正在与评论组件握手…')

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'furtalk:authorization-init',
          request_id: 'some-other-request',
        },
        origin: embeddingOrigin,
        source: openerMock,
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(sessionStorage.getItem(pendingRecordKey(requestId))).toBeNull()
    expect(apiMocks.context).not.toHaveBeenCalled()
  })

  it('ignores messages from a non-opener source', async () => {
    renderAuthorize()
    await screen.findByText('正在与评论组件握手…')

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'furtalk:authorization-init',
          request_id: requestId,
        },
        origin: embeddingOrigin,
        source: {} as Window,
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(apiMocks.context).not.toHaveBeenCalled()
  })

  it('recovers the pending record after a login return and re-acks ready', async () => {
    const record = pendingRecord()
    writePendingAuthorization(sessionStorage, record)
    renderAuthorize()

    await waitFor(() => {
      expect(apiMocks.context).toHaveBeenCalledWith(siteId, embeddingOrigin)
    })
    expect(openerPostMessage).toHaveBeenCalledWith(
      { type: 'furtalk:authorization-ready', request_id: requestId },
      embeddingOrigin,
    )
    expect(await screen.findByText('站点：Example Blog')).toBeInTheDocument()
  })
})

describe('AuthorizePage context errors', () => {
  it('navigates to login with the authorize marker on 401', async () => {
    apiMocks.context.mockRejectedValue(
      new ApiError('需要登录', 401, 'unauthorized'),
    )
    renderAuthorize()
    dispatchInit()

    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        to: '/login',
        search: {
          authorize: '1',
          redirect: authorizeLoginRedirect(siteId, requestId),
        },
      })
    })
  })

  it('renders a recoverable error for a 403 context failure', async () => {
    apiMocks.context.mockRejectedValue(
      new ApiError('站点不可用或 origin 不被允许', 403, 'forbidden'),
    )
    renderAuthorize()
    dispatchInit()

    expect(
      await screen.findByText('站点不可用或 origin 不被允许'),
    ).toBeInTheDocument()
    expect(apiMocks.navigate).not.toHaveBeenCalled()
  })
})

describe('AuthorizePage explicit consent', () => {
  it('issues a code only after the authorize click and posts it to the opener', async () => {
    renderAuthorize()
    dispatchInit()
    await screen.findByText('站点：Example Blog')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '授权' }))

    await waitFor(() => {
      expect(apiMocks.issue).toHaveBeenCalledWith({
        site_id: siteId,
        origin: embeddingOrigin,
        request_id: requestId,
      })
    })
    await waitFor(() => {
      expect(openerPostMessage).toHaveBeenCalledWith(
        {
          type: 'furtalk:authorization-success',
          request_id: requestId,
          code: 'auth-code',
        },
        embeddingOrigin,
      )
    })
    expect(closeMock).toHaveBeenCalled()
    expect(sessionStorage.getItem(pendingRecordKey(requestId))).toBeNull()
  })

  it('never issues a code on page load alone', async () => {
    renderAuthorize()
    dispatchInit()
    await screen.findByText('站点：Example Blog')
    expect(apiMocks.issue).not.toHaveBeenCalled()
    const successMessages = openerPostMessage.mock.calls.filter(
      ([message]) => message?.type === 'furtalk:authorization-success',
    )
    expect(successMessages).toHaveLength(0)
  })

  it('posts cancellation and closes without issuing a code', async () => {
    renderAuthorize()
    dispatchInit()
    await screen.findByText('站点：Example Blog')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(openerPostMessage).toHaveBeenCalledWith(
      { type: 'furtalk:authorization-cancelled', request_id: requestId },
      embeddingOrigin,
    )
    expect(closeMock).toHaveBeenCalled()
    expect(apiMocks.issue).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(pendingRecordKey(requestId))).toBeNull()
  })
})

describe('AuthorizePage issue without profile mutation', () => {
  it('never forwards the pending email hint into the issue payload', async () => {
    renderAuthorize()
    dispatchInit()
    await screen.findByText('站点：Example Blog')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '授权' }))

    await waitFor(() => {
      expect(apiMocks.issue).toHaveBeenCalled()
    })
    const payload = apiMocks.issue.mock.calls[0]?.[0]
    expect(payload).toEqual({
      site_id: siteId,
      origin: embeddingOrigin,
      request_id: requestId,
    })
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('nickname')
    expect(payload).not.toHaveProperty('website_url')
  })
})
