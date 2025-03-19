import { MarkdownHooks } from 'react-markdown';
import rehypeStarryNight from 'rehype-starry-night';
import remarkGfm from 'remark-gfm';

export const Markdown = ({ value }: { value: string }) => {
  console.log(JSON.stringify(value));
  return (
    <div className="markdown-body ov">
      <MarkdownHooks
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeStarryNight]}
      >
        {value}
      </MarkdownHooks>
    </div>
  );
};
