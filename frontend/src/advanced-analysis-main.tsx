/**
 * 高级分析页面入口
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AdvancedAnalysisPage from './pages/AdvancedAnalysisPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdvancedAnalysisPage />
  </StrictMode>,
)
