import { CicordApiError, type OnboardingCompleteResponse, type PortalRole } from "@cicord/client";
import {
  OnboardingFlow,
  useLinkTokenLogin,
  useMe,
  useMember,
  type OnboardingFlowState,
} from "@cicord/react";
import {
  Button,
  ChoiceGroup,
  ChoiceTile,
  LinkButton,
  MemberCard,
  Notice,
  Spinner,
  Stepper,
} from "@cicord/ui";
import { useEffect, useMemo, useRef } from "react";
import { useT } from "../i18n/index.tsx";
import { useLogin, useServer } from "../portal.tsx";

export function Onboarding() {
  const t = useT();
  const linkLogin = useLinkTokenLogin();
  const me = useMe();
  const login = useLogin();

  if (linkLogin.status === "pending" || (me.isLoading && linkLogin.status !== "error")) {
    return <Loading label={t.loggingIn} />;
  }
  if (!me.data) {
    return (
      <div className="onboarding-gate">
        <h1>{t.onboarding.loginTitle}</h1>
        {linkLogin.status === "error" ? (
          <Notice tone="error">{t.onboarding.linkFailed}</Notice>
        ) : (
          <p>{t.onboarding.loginText}</p>
        )}
        <Button size="lg" onClick={login}>
          {t.login}
        </Button>
      </div>
    );
  }

  return (
    <OnboardingFlow>
      {(flow) => {
        switch (flow.status) {
          case "loading":
            return <Loading label={t.loading} />;
          case "unauthenticated":
            return (
              <div className="onboarding-gate">
                <h1>{t.onboarding.loginTitle}</h1>
                <Button size="lg" onClick={login}>
                  {t.login}
                </Button>
              </div>
            );
          case "unavailable":
            return <Notice title={t.onboarding.unavailable} />;
          case "error":
            return (
              <Notice
                tone="error"
                title={
                  flow.error instanceof CicordApiError && flow.error.code === "forbidden"
                    ? t.onboarding.forbidden
                    : t.onboarding.failed
                }
                action={
                  <Button variant="secondary" size="sm" onClick={flow.reload}>
                    {t.onboarding.retry}
                  </Button>
                }
              />
            );
          case "complete":
            return <Done flow={flow} result={flow.result!} />;
          default:
            return <Steps flow={flow} />;
        }
      }}
    </OnboardingFlow>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="portal-loading portal-loading--inline">
      <Spinner size="lg" label={label} />
      <p>{label}</p>
    </div>
  );
}

/** Roles the member would have with the current answers (live preview). */
function usePreviewRoles(flow: OnboardingFlowState): { roles: PortalRole[]; fresh: string[] } {
  const member = useMember();
  return useMemo(() => {
    const current = member.data?.member.roles ?? [];
    const offered = new Set(flow.steps.flatMap((s) => s.options.map((o) => o.role)));
    const picked = flow.steps.flatMap((s) =>
      s.options.filter((o) => (flow.answers[s.id] ?? []).includes(o.role)),
    );
    const roles: PortalRole[] = current.filter((r) => !offered.has(r.key));
    const completed = flow.data?.completedRole;
    if (completed && !roles.some((r) => r.key === completed.key)) {
      roles.push({
        key: completed.key,
        id: completed.id,
        name: completed.name,
        color: completed.color,
      });
    }
    // Preview only: the role id is not known until the plugin assigns it.
    for (const o of picked) roles.push({ key: o.role, id: "", name: o.name, color: o.color });
    const had = new Set(current.map((r) => r.key));
    return { roles, fresh: roles.filter((r) => !had.has(r.key)).map((r) => r.key) };
  }, [member.data, flow.steps, flow.answers, flow.data]);
}

function Steps({ flow }: { flow: OnboardingFlowState }) {
  const t = useT();
  const me = useMe();
  const server = useServer();
  const preview = usePreviewRoles(flow);
  const step = flow.step;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new question when the step changes (not on first load).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [flow.index]);

  if (!step) return <Notice title={t.onboarding.unavailable} />;
  const user = me.data?.user;
  const error = flow.stepErrors[step.id];
  // A single option is a yes/no toggle: checkbox semantics, no "one choice" hint.
  const toggleLike = step.multiple || step.options.length === 1;
  const hint = [
    step.options.length > 1 ? (step.multiple ? t.onboarding.multiple : t.onboarding.single) : null,
    step.required ? t.onboarding.required : t.onboarding.optional,
  ]
    .filter(Boolean)
    .join(", ");
  const headingId = `step-${step.id}`;

  return (
    <div className="onboarding">
      <div className="onboarding__flow">
        <header className="onboarding__intro">
          <h1 className="onboarding__title">{flow.data?.title}</h1>
          {flow.index === 0 && flow.data?.intro ? (
            <p className="onboarding__lead">{flow.data.intro}</p>
          ) : null}
        </header>

        <Stepper
          steps={flow.steps.map((s) => ({ id: s.id, label: s.title }))}
          current={flow.index}
          onSelect={flow.goTo}
          label={t.onboarding.progress}
        />

        <section className="onboarding__step" aria-labelledby={headingId} key={step.id}>
          <p className="onboarding__count">{t.onboarding.step(flow.index + 1, flow.total)}</p>
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className="onboarding__question">
            {step.title}
          </h2>
          {step.description ? <p className="onboarding__description">{step.description}</p> : null}
          <p className="onboarding__hint">{hint}</p>

          <ChoiceGroup label={step.title} labelledBy={headingId} multiple={toggleLike}>
            {step.options.map((option) => (
              <ChoiceTile
                key={option.role}
                label={option.label}
                description={option.description}
                emoji={option.emoji}
                color={option.color || undefined}
                multiple={toggleLike}
                selected={flow.isSelected(option.role)}
                onToggle={() => flow.toggle(option.role)}
                disabled={flow.status === "submitting"}
              />
            ))}
          </ChoiceGroup>

          {error ? (
            <Notice tone="error" className="onboarding__error">
              {error}
            </Notice>
          ) : null}
        </section>

        <div className="onboarding__nav">
          <Button
            variant="ghost"
            onClick={flow.back}
            disabled={flow.isFirst || flow.status === "submitting"}
          >
            {t.onboarding.back}
          </Button>
          <div className="onboarding__nav-end">
            {!flow.canContinue ? (
              <span className="onboarding__nav-hint">{t.onboarding.pickOne}</span>
            ) : null}
            <Button
              size="lg"
              onClick={flow.next}
              disabled={!flow.canContinue}
              loading={flow.status === "submitting"}
            >
              {flow.status === "submitting"
                ? t.onboarding.saving
                : flow.isLast
                  ? t.onboarding.finish
                  : t.onboarding.next}
            </Button>
          </div>
        </div>
      </div>

      <aside className="onboarding__preview" aria-label={t.onboarding.previewTitle}>
        <p className="onboarding__preview-title">{t.onboarding.previewTitle}</p>
        {user ? (
          <MemberCard
            displayName={user.displayName}
            username={user.username}
            avatarUrl={user.avatarUrl || undefined}
            roles={preview.roles}
            fresh={preview.fresh}
            rolesLabel={t.onboarding.previewRoles}
            emptyRoles={t.onboarding.noRoles}
            caption={server.name}
          />
        ) : null}
      </aside>
    </div>
  );
}

function Done({ flow, result }: { flow: OnboardingFlowState; result: OnboardingCompleteResponse }) {
  const t = useT();
  const me = useMe();
  const user = me.data?.user;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="done">
      <div className="done__card">
        {user ? (
          <MemberCard
            displayName={user.displayName}
            username={user.username}
            avatarUrl={user.avatarUrl || undefined}
            roles={result.roles}
            fresh={result.added}
            rolesLabel={t.onboarding.previewRoles}
            emptyRoles={t.onboarding.noRoles}
          />
        ) : null}
      </div>
      <div className="done__text">
        <h1 ref={headingRef} tabIndex={-1}>
          {t.onboarding.doneTitle}
        </h1>
        <p className="done__message">{result.message}</p>
        <p className="done__count">{t.onboarding.added(result.added.length)}</p>
        <div className="done__actions">
          <LinkButton href="https://discord.com/app" size="lg">
            {t.onboarding.openDiscord}
          </LinkButton>
          <Button variant="ghost" onClick={flow.restart}>
            {t.onboarding.edit}
          </Button>
        </div>
      </div>
    </div>
  );
}
