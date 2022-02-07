import Swagger from "swagger-client";
const OPENAPI_URL =
  "https://swaggerapis.rainmaker.espressif.com/Rainmaker_Swagger.yaml";

const requestInterceptor = (request) => {
  console.log(request);
  return request;
};
class RainMaker {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.accesstoken = null;
    if (this.username === undefined || this.password === undefined) {
      throw new Error("One or all Credentials are undefined");
    }
  }
  async authenticate() {
    const credentials = {
      user_name: this.username,
      password: this.password,
    };
    const apiClient = await Swagger({
      url: OPENAPI_URL,
      responseContentType: "application/json",
      authorizations: { AccessToken: "" },
    });
    try {
      const response = await apiClient.apis.User.login(
        { version: "v1" },
        {
          requestBody: credentials,
        }
      );
      this.accesstoken = response.body.accesstoken;
      return true;
    } catch (error) {
      console.log(error);
      return error.response.body;
    }
  }
  async getUserNodes(detailed) {
    const apiClient = await Swagger({
      url: OPENAPI_URL,
      responseContentType: "application/json",
      authorizations: { AccessToken: this.accesstoken },
    });
    try {
      const response = await apiClient.apis[
        "User Node Association"
      ].getUserNodes({ version: "v1", node_details: detailed });
      return { status: response.status, result: response.body };
    } catch (error) {
      return { status: error.status, result: error.response.body };
    }
  }
}

export { RainMaker };
