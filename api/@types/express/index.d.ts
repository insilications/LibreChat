import type OpenAIClient from '~/app/clients/OpenAIClient';
import type paths from '~/config/paths';
import type { FileSources } from 'librechat-data-provider';
// import type { Express, Request, Response, NextFunction } from 'express-serve-static-core';
// import type { Response, NextFunction } from 'express';
// import 'express';
// import type { User, Request, Response, NextFunction } from 'express-serve-static-core';

declare module 'express-serve-static-core' {
  export interface User {
    id: string;
  }

  export interface Request {
    user: User;
  }

  export interface Locals {
    ocr: TCustomConfig['ocr'];
    paths: typeof paths;
    fileStrategy: FileSources;
    socialLogins?: string[];
    filteredTools?: string[];
    includedTools?: string[];
    availableTools: Record<string, FunctionTool>;
    imageOutputType: EImageOutputType;
    interfaceConfig: TCustomConfig['interface'];
  }
}

// declare global {
//   namespace Express {
//     export interface User {
//       id: string;
//     }

//     export interface Locals {
//       ocr: TCustomConfig['ocr'];
//       paths: typeof paths;
//       fileStrategy: FileSources;
//       socialLogins?: string[];
//       filteredTools?: string[];
//       includedTools?: string[];
//       availableTools: Record<string, FunctionTool>;
//       imageOutputType: EImageOutputType;
//       interfaceConfig: TCustomConfig['interface'];
//     }
//   }
// }
