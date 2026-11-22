export function WorkflowRail({ items, testId = "workflow-rail" }) {
  return (
    <ol className="workflow" data-testid={testId}>
      {items.map((item, index) => {
        const Tag = item.onClick ? "button" : "div";
        return (
          <li key={item.id}>
            <Tag type={item.onClick ? "button" : undefined} className={`workflow-step is-${item.state || "wait"}`} onClick={item.onClick} data-testid={`workflow-${item.id}`}>
              <span className="workflow-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="workflow-copy">
                <strong>{item.label}</strong>
                <em>{item.detail}</em>
              </span>
            </Tag>
          </li>
        );
      })}
    </ol>
  );
}
