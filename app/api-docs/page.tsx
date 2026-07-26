"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

// swagger-ui-react touches the DOM directly and doesn't support SSR.
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 py-6">
      <SwaggerUI url="/openapi.yaml" />
    </div>
  );
}
