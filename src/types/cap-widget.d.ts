import type { CapWidget } from 'cap-widget'

// 声明 cap-widget 自定义元素为合法 JSX 标签。
// cap-widget 包在引入时注册自定义元素，React 19 通过 ref 透传 DOM 节点。
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'cap-widget': React.DetailedHTMLProps<
        React.HTMLAttributes<CapWidget> & {
          'data-cap-api-endpoint'?: string
          'data-cap-worker-count'?: string
        },
        CapWidget
      >
    }
  }
}
