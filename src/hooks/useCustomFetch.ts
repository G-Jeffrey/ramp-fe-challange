import { useCallback, useContext } from "react"
import { AppContext } from "../utils/context"
import { fakeFetch, RegisteredEndpoints } from "../utils/fetch"
import { useWrappedRequest } from "./useWrappedRequest"

export function useCustomFetch() {
  const { cache } = useContext(AppContext)
  const { loading, wrappedRequest } = useWrappedRequest()
  const fetchWithCache = useCallback(
    async <TData, TParams extends object = object>(
      endpoint: RegisteredEndpoints,
      params?: TParams
    ): Promise<TData | null> =>
      wrappedRequest<TData>(async () => {
        const cacheKey = getCacheKey(endpoint, params)
        const cacheResponse = cache?.current.get(cacheKey)
        if (cacheResponse) {
          const data = JSON.parse(cacheResponse)
          return data as Promise<TData>
        }

        const result = await fakeFetch<TData>(endpoint, params)
        cache?.current.set(cacheKey, JSON.stringify(result))
        return result
      }),
    [cache, wrappedRequest]
  )

  const fetchWithoutCache = useCallback(
    async <TData, TParams extends object = object>(
      endpoint: RegisteredEndpoints,
      params: {transactionId: string, value: boolean}
    ): Promise<TData | null> =>
      wrappedRequest<TData>(async () => {
        const result = await fakeFetch<TData>(endpoint, params);
        
        /*
        If we search the cache for where endpoint exists, where it could be in both the
        user and paginated page, that would be O(n), then we would edit for O(1),
        whereas if we delete the cache so that the app can update, it would also be O(n)
        */
            cache?.current?.forEach((curr,idx) => {
              let json = JSON.parse(curr);
              alterCache(json, params.transactionId, params.value, idx);
            })
        return result
      }),
    [wrappedRequest]
  )
  const alterCache = (json: any, transactionId:string , value: boolean, key: string): void => {
    if(key==='employee') return;
    const nextPage = json.nextPage || null; 
    if(json.data) json = json.data;
      for (let i = 0; i < json.length; i++) {
        if (json[i].id === transactionId) {
          json[i].approved = value;
        }
      }
    if(nextPage!==null) cache?.current?.set(key, JSON.stringify({'nextPage': nextPage, 'data':json}));
    else cache?.current?.set(key, JSON.stringify(json));
  }
  const clearCache = useCallback(() => {
    if (cache?.current === undefined) {
      return
    }

    cache.current = new Map<string, string>()
  }, [cache])

  const clearCacheByEndpoint = useCallback(
    (endpointsToClear: RegisteredEndpoints[]) => {
      if (cache?.current === undefined) {
        return
      }

      const cacheKeys = Array.from(cache.current.keys())

      for (const key of cacheKeys) {
        const clearKey = endpointsToClear.some((endpoint) => key.startsWith(endpoint))

        if (clearKey) {
          cache.current.delete(key)
        }
      }
    },
    [cache]
  )

  return { fetchWithCache, fetchWithoutCache, clearCache, clearCacheByEndpoint, loading }
}

function getCacheKey(endpoint: RegisteredEndpoints, params?: object) {
  return `${endpoint}${params ? `@${JSON.stringify(params)}` : ""}`
}
