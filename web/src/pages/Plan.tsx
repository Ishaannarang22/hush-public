import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import plan from '../../../docs/PLAN.md?raw'

export default function Plan() {
  return (
    <article className="plan">
      <Markdown remarkPlugins={[remarkGfm]}>{plan}</Markdown>
    </article>
  )
}
