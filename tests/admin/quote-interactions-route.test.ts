import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn() }));
vi.mock('@/lib/security/adminMutationAuth', () => ({ requireOfficeReadAuth: mocks.auth }));
vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: mocks.client }));
import { GET } from '@/app/api/admin/quotes/[id]/interactions/route';
const request = () => new NextRequest('http://localhost/api/admin/quotes/201/interactions');
function mockDb(replies: { data: unknown[] | null; error: unknown }[]) {
  const chains: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const from = vi.fn(() => {
    const index = chains.length;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for(const method of ['select','eq','in','not','order'])chain[method]=vi.fn(()=>chain);
    chain.limit=vi.fn(()=>Promise.resolve(replies[index]));chains.push(chain);return chain;
  });
  mocks.client.mockReturnValue({from});return {from,chains};
}
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockReturnValue({ok:true,user:'test-admin'});});
describe('teklife bağlı mevcut görüşme defteri: salt okuma',()=>{
  it('kimliksiz isteği DB oluşturulmadan durdurur',async()=>{
    mocks.auth.mockReturnValue({ok:false,response:NextResponse.json({ok:false},{status:401})});
    expect((await GET(request(),{params:Promise.resolve({id:'201'})})).status).toBe(401);expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(['0','-1','1.5','9223372036854775808'])('geçersiz kimlik %s DB sorgusu üretmez',async id=>{
    expect((await GET(request(),{params:Promise.resolve({id})})).status).toBe(400);expect(mocks.client).not.toHaveBeenCalled();
  });
  it('patron okuyabilir, büyük bigint metin olarak sorgulanır, yalnız SELECT zinciri kullanılır',async()=>{
    mocks.auth.mockReturnValue({ok:true,user:'patron'});
    const db=mockDb([{data:[],error:null},{data:[],error:null},{data:[],error:null}]);
    const res=await GET(request(),{params:Promise.resolve({id:'9223372036854775807'})});
    expect(res.status).toBe(200);expect(res.headers.get('cache-control')).toBe('no-store');
    expect(db.from).toHaveBeenCalledTimes(3);
    for(const chain of db.chains){expect(chain.eq).toHaveBeenCalledWith('quote_id','9223372036854775807');expect(chain.select.mock.calls[0][0]).toContain('id::text');}
  });
  it('v24 yok veya okuma başarısız: boş geçmiş gibi davranmaz',async()=>{
    mockDb([{data:null,error:{code:'42P01'}},{data:[],error:null},{data:[],error:null}]);
    const res=await GET(request(),{params:Promise.resolve({id:'201'})});expect(res.status).toBe(503);expect((await res.json()).ok).toBe(false);
  });
  it('yüz satır sınırı ilk başarıyı veya son girişimi kaybettirmez',async()=>{
    const first={id:'1',quote_id:'201',outcome:'ulasildi'},latest={id:'999',quote_id:'201',outcome:'ulasilamadi'};
    mockDb([{data:Array.from({length:101},(_,i)=>({id:String(i+20)})),error:null},{data:[first],error:null},{data:[latest],error:null}]);
    const body=await (await GET(request(),{params:Promise.resolve({id:'201'})})).json();
    expect(body.interactions).toHaveLength(100);expect(body.hasOlder).toBe(true);expect(body.firstSuccess).toEqual(first);expect(body.latestAttempt).toEqual(latest);
  });
});
