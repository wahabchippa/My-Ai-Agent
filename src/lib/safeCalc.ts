// Safe math evaluator — sirf digits, `+ - * / % ^ ( )` aur decimals.
// `Function()`/eval ke bajaye recursive descent parser (code-injection
// ka koi rasta nahi). Ghalat expression par `null`.
export function safeCalc(expr: string): number | null {
  const s = expr.replace(/\s+/g, "");
  let i = 0;

  const num = (): number => {
    const start = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    if (start === i) throw new Error("expected number");
    const v = parseFloat(s.slice(start, i));
    if (!isFinite(v)) throw new Error("bad number");
    return v;
  };
  const factor = (): number => {
    // unary + / -
    if (s[i] === "-") {
      i++;
      return -factor();
    }
    if (s[i] === "+") {
      i++;
      return factor();
    }
    if (s[i] === "(") {
      i++;
      const v = exprFn(); // paren ke andar POORA expression (sirf term nahi)
      if (s[i] !== ")") throw new Error("missing )");
      i++;
      return v;
    }
    return num();
  };
  const power = (): number => {
    const v = factor();
    if (s[i] === "^") {
      i++;
      return Math.pow(v, power());
    }
    return v;
  };
  const term = (): number => {
    let v = power();
    while (s[i] === "*" || s[i] === "/" || s[i] === "%") {
      const op = s[i];
      i++;
      const r = power();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  };
  const exprFn = (): number => {
    let v = term();
    while (s[i] === "+" || s[i] === "-") {
      const op = s[i];
      i++;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };

  try {
    const v = exprFn();
    return i === s.length ? v : null;
  } catch {
    return null;
  }
}
