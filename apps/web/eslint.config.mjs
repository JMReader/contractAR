import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next@16 exporta flat config nativo: no hace falta FlatCompat.
const eslintConfig = [...nextVitals, ...nextTs];

export default eslintConfig;
