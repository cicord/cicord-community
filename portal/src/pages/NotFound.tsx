import { useT } from "../i18n/index.tsx";
import { CenteredMessage, useDocumentTitle } from "../portal.tsx";
import { Link } from "../router.tsx";

export function NotFound() {
  const t = useT();
  useDocumentTitle(t.notFound.title);
  return (
    <CenteredMessage title={t.notFound.title}>
      <p>{t.notFound.text}</p>
      <Link to="/" className="cicord-button cicord-button--secondary cicord-button--md">
        <span className="cicord-button__label">{t.notFound.home}</span>
      </Link>
    </CenteredMessage>
  );
}
