import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
  return <Sonner className="toaster group" position="bottom-right" richColors {...props} />;
}

export { Toaster };
// Re-exported so consumers fire toasts through @boost/ui rather than depending on
// `sonner` directly (it's this lib's dep). Needs <Toaster/> mounted once (App).
export { toast } from 'sonner';
