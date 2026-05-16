/**
 * IrisPageContext — lets pages declare what they're showing so Iris can
 * answer in context ("on the Calculator with a Sedan-sized full detail" /
 * "looking at customer Jane Doe").
 *
 * Pages call useRegisterIrisContext({...}) inside an effect; the dock /
 * panel reads it via useIrisPageContext().
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface IrisPageContext {
  /** Stable page key — drives suggestion chips + system prompt framing. */
  page:
    | "dashboard"
    | "calendar"
    | "customers"
    | "customer-detail"
    | "leads"
    | "tasks"
    | "services"
    | "revenue"
    | "expenses"
    | "calculator"
    | "work"
    | "photos"
    | "receipts"
    | "settings"
    | "tax-center"
    | "mileage"
    | "checklists"
    | "templates"
    | "iris"
    | "other";
  /** Human label for the page (e.g. "Customer · Jane Doe"). */
  label?: string;
  /** Optional entity the user is focused on. */
  entity?:
    | { type: "customer"; id: string; name?: string }
    | { type: "appointment"; id: string }
    | { type: "service"; id: string; name?: string; vehicleSize?: string }
    | { type: "lead"; id: string; name?: string }
    | { type: "receipt"; id: string }
    | { type: "date"; iso: string };
  /** Anything else worth telling Iris (kept small — avoid PII). */
  extra?: Record<string, string | number | boolean | null>;
}

interface IrisPageContextStore {
  current: IrisPageContext | null;
  register: (ctx: IrisPageContext) => void;
  clear: () => void;
}

const Ctx = createContext<IrisPageContextStore | null>(null);

export function IrisPageContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState<IrisPageContext | null>(null);

  const register = useCallback((ctx: IrisPageContext) => {
    setCurrent(ctx);
  }, []);

  const clear = useCallback(() => {
    setCurrent(null);
  }, []);

  const value = useMemo<IrisPageContextStore>(
    () => ({ current, register, clear }),
    [current, register, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIrisPageContext(): IrisPageContext | null {
  const store = useContext(Ctx);
  return store?.current ?? null;
}

/**
 * Register the current page's Iris context. Pages call this near the top
 * of their render with a stable object — re-registration on every value
 * change keeps the dock in sync.
 *
 * Pass `null` (or unmount) to clear.
 */
export function useRegisterIrisContext(ctx: IrisPageContext | null) {
  const store = useContext(Ctx);
  const key = ctx
    ? `${ctx.page}|${ctx.label ?? ""}|${ctx.entity?.type ?? ""}|${
        ctx.entity && "id" in ctx.entity ? ctx.entity.id : ""
      }|${ctx.entity && "iso" in ctx.entity ? ctx.entity.iso : ""}|${
        ctx.extra ? JSON.stringify(ctx.extra) : ""
      }`
    : "__null__";

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    if (!store) return;
    if (ctxRef.current) {
      store.register(ctxRef.current);
    } else {
      store.clear();
    }
    return () => {
      store.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, key]);
}
