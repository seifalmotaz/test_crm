import { client } from "../api/client.gen";
import type { AuthResponseDto, ProblemDetailsDto } from "../api/types.gen";

export type { AuthResponseDto, ProblemDetailsDto };

export { client };

client.setConfig({
  baseUrl: "https://estate-crm.localhost:1355",
  credentials: "include",
});
