declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: Function
  }
}

import { createStore, applyMiddleware, compose, Store } from 'redux'
import createSagaMiddleware from 'redux-saga'

import selectors from './selectors'
import reducers from './reducers'

import { State as LifecycleState } from './lifecycle.store'
import { State as ChaptersState } from './chapters.store'
import { State as episodeState } from './episode.store'
import { State as runtimeState } from './runtime.store'
import { State as postState } from './post.store'
import { State as transcriptsState } from './transcripts.store'

import lifecycleSaga from '../sagas/lifecycle.sagas'

export interface State {
  lifecycle: LifecycleState,
  chapters: ChaptersState,
  episode: episodeState,
  runtime: runtimeState,
  post: postState,
  transcripts: transcriptsState
}

const sagas = createSagaMiddleware()

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose
export const store: Store<State> = createStore(reducers, composeEnhancers(applyMiddleware(sagas)))

sagas.run(lifecycleSaga());

export { selectors, sagas }
