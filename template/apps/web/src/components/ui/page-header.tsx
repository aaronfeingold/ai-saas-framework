interface PageHeaderProps {
  title: string;
  description: string;
  className?: string;
}

export const PageHeader = ({
  title,
  description,
  className,
}: PageHeaderProps) => {
  return (
    <div className={`flex flex-col gap-1 p-6 ${className || ''}`}>
      <h3 className="text-3xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};
