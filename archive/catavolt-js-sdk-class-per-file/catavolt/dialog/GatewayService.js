/**
 * Created by rburson on 3/12/15.
 */
import { Future } from "../fp/Future";
import { Get } from "../ws/Request";
/*
 @TODO - current the gateway response is mocked, due to cross-domain issues
 This should be removed (and the commented section uncommented for production!!!
 */
export class GatewayService {
    static getServiceEndpoint(tenantId, serviceName, gatewayHost) {
        //We have to fake this for now, due to cross domain issues
        /*
         var fakeResponse = {
         responseType:"soi-json",
         tenantId:"***REMOVED***z",
         serverAssignment:"https://dfw.catavolt.net/vs301",
         appVersion:"1.3.262",soiVersion:"v02"
         }

         var endPointFuture = Future.createSuccessfulFuture<ServiceEndpoint>('serviceEndpoint', <any>fakeResponse);

         */
        var f = Get.fromUrl('https://' + gatewayHost + '/' + tenantId + '/' + serviceName).perform();
        var endPointFuture = f.bind((jsonObject) => {
            //'bounce cast' the jsonObject here to coerce into ServiceEndpoint
            return Future.createSuccessfulFuture("serviceEndpoint", jsonObject);
        });
        return endPointFuture;
    }
}