import { client } from "../api/client.gen";
import type { AuthResponseDto, ProblemDetailsDto } from "../api/types.gen";

export type { AuthResponseDto, ProblemDetailsDto };

export { client };

const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;

client.setConfig({
  baseUrl,
  credentials: "include",
});
