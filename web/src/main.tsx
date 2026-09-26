import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ClickSpark from "./fx/ClickSpark";
import SmoothScroll from "./fx/SmoothScroll";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SmoothScroll>
          <ClickSpark>
            <App />
          </ClickSpark>
        </SmoothScroll>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
