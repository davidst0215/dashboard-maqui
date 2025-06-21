export const Textarea = ({ className, ...props }) => (
  <textarea className={`w-full px-3 py-2 border rounded-md min-h-[120px] ${className}`} {...props} />
);