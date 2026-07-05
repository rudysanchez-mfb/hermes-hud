import useSWR from 'swr'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

/** SWR wrapper for pipeline endpoints — 15s refresh, keep stale data visible. */
export function usePipeline<T = any>(path: string) {
  return useSWR<T>(`/api${path}`, fetcher, {
    refreshInterval: 15_000,
    dedupingInterval: 5_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    errorRetryCount: 3,
    errorRetryInterval: 2000,
  })
}
