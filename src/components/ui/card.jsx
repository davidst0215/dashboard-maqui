export const Card = ({ className, ...props }) => (
  <div className={`bg-white rounded-lg shadow-md ${className}`} {...props} />
);

export const CardHeader = ({ className, ...props }) => (
  <div className={`p-6 ${className}`} {...props} />
);

export const CardTitle = ({ className, ...props }) => (
  <h3 className={`text-lg font-bold tracking-tight ${className}`} {...props} />
);

export const CardContent = ({ className, ...props }) => (
  <div className={`p-6 pt-0 ${className}`} {...props} />
);